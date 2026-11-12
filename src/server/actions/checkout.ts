"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { razorpay, razorpayConfigured, verifyCheckoutSignature } from "@/lib/razorpay";
import { getCart, ensureCartId } from "@/server/cart";
import {
  createOrderFromCart,
  createRazorpayOrderFor,
  markOrderPaid,
  markPaymentFailed,
  priceCart,
  setOrderStatus,
  validateCoupon,
  type Pricing,
  type ShippingAddressInput,
} from "@/server/orders";
import { addressSchema } from "@/server/validation";

type RazorpayLaunch = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; razorpay?: RazorpayLaunch }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const placeOrderSchema = z.object({
  addressId: z.string().cuid().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().default(false),
  method: z.enum(["RAZORPAY", "COD"]),
  couponCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function applyCouponAction(code: string): Promise<{ ok: boolean; error?: string; pricing?: Pricing }> {
  const limited = await rateLimit("coupon", 20, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: "Too many attempts – please wait a moment." };
  const user = await getCurrentUser();
  const cart = await getCart();
  const result = await validateCoupon(code, cart.subtotalPaise, user?.id ?? null);
  const cartId = await ensureCartId();
  if (!result.ok) {
    await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
    return { ok: false, error: result.error, pricing: await priceCart(cart, null, user?.id ?? null) };
  }
  await db.cart.update({ where: { id: cartId }, data: { couponCode: result.coupon.code } });
  return { ok: true, pricing: await priceCart(cart, result.coupon.code, user?.id ?? null) };
}

export async function removeCouponAction(): Promise<Pricing> {
  const user = await getCurrentUser();
  const cartId = await ensureCartId();
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  return priceCart(await getCart(), null, user?.id ?? null);
}

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to place your order." };
  const limited = await rateLimit("checkout", 10, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: "Too many attempts – please wait a few minutes." };

  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.slice(-1).join(".")] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const { commerce } = await getSettings();

  if (data.method === "COD" && !commerce.codEnabled) return { ok: false, error: "Cash on delivery is not available." };
  if (data.method === "RAZORPAY" && !razorpayConfigured()) {
    return { ok: false, error: "Online payment is not available yet (awaiting Razorpay credentials). Please try again later or order on WhatsApp." };
  }

  // Resolve the delivery address (saved address must belong to this customer).
  let address: ShippingAddressInput | undefined = data.address;
  if (data.addressId) {
    const saved = await db.address.findFirst({ where: { id: data.addressId, userId: user.id } });
    if (!saved) return { ok: false, error: "Please choose a delivery address." };
    address = saved;
  }
  if (!address) return { ok: false, error: "Please add a delivery address." };

  const cart = await getCart();
  if (!cart.lines.length) return { ok: false, error: "Your cart is empty." };
  if (cart.hasProblems) return { ok: false, error: "Some items in your cart need attention – please review your cart." };

  const pricing = await priceCart(cart, data.couponCode || null, user.id);
  if (data.couponCode && pricing.couponError) return { ok: false, error: pricing.couponError };
  if (pricing.totalPaise < 100) return { ok: false, error: "Order total must be at least ₹1." };

  let order;
  try {
    order = await createOrderFromCart({ user, cart, pricing, address, method: data.method, note: data.note });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create your order." };
  }

  if (data.saveAddress && data.address) {
    const count = await db.address.count({ where: { userId: user.id } });
    await db.address.create({ data: { ...data.address, userId: user.id, isDefault: count === 0 } });
  }

  if (data.method === "COD") return { ok: true, orderNumber: order.number };

  try {
    const launch = await createRazorpayOrderFor(order.id);
    return {
      ok: true,
      orderNumber: order.number,
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID!,
        razorpayOrderId: launch.razorpayOrderId,
        amountPaise: launch.amountPaise,
        orderNumber: order.number,
        prefill: { name: order.customerName, email: order.email, contact: order.phone },
      },
    };
  } catch (err) {
    console.error("[razorpay:create-order]", err);
    return { ok: false, error: "We couldn't start the payment. Your order is saved – you can retry payment from your account." };
  }
}

export async function retryPaymentAction(orderNumber: string): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (!razorpayConfigured()) return { ok: false, error: "Online payment is awaiting Razorpay credentials." };
  const order = await db.order.findFirst({ where: { number: orderNumber, userId: user.id }, include: { items: true } });
  if (!order || !["PENDING", "FAILED"].includes(order.paymentStatus) || order.status === "CANCELLED") {
    return { ok: false, error: "This order can't be paid." };
  }
  for (const item of order.items) {
    if (!item.variantId) return { ok: false, error: `${item.productName} is no longer available.` };
    const v = await db.productVariant.findUnique({ where: { id: item.variantId } });
    if (!v || !v.isActive || v.stock < item.quantity) return { ok: false, error: `${item.productName} (${item.variantLabel}) is out of stock.` };
  }
  const launch = await createRazorpayOrderFor(order.id);
  return {
    ok: true,
    orderNumber: order.number,
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID!,
      razorpayOrderId: launch.razorpayOrderId,
      amountPaise: launch.amountPaise,
      orderNumber: order.number,
      prefill: { name: order.customerName, email: order.email, contact: order.phone },
    },
  };
}

const verifySchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

/** Never trusts the browser alone: verifies the signature AND fetches the payment from Razorpay. */
export async function verifyPaymentAction(input: unknown): Promise<{ ok: boolean; orderNumber?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response." };
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const payment = await db.payment.findUnique({ where: { providerOrderId: razorpay_order_id }, include: { order: true } });
  if (!payment || payment.order.userId !== user.id) return { ok: false, error: "Payment not found." };
  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    await db.payment.update({ where: { id: payment.id }, data: { errorDescription: "Signature verification failed" } });
    return { ok: false, error: "Payment could not be verified. If money was deducted it will be reconciled automatically." };
  }

  try {
    let rzp = await razorpay().payments.fetch(razorpay_payment_id);
    if (rzp.order_id !== razorpay_order_id) return { ok: false, error: "Payment does not match this order." };
    if (rzp.status === "authorized") rzp = await razorpay().payments.capture(razorpay_payment_id, Number(rzp.amount), "INR");
    if (rzp.status !== "captured") return { ok: false, error: "Payment is not complete yet. We'll update your order as soon as it is confirmed." };
    await markOrderPaid({
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      amountPaise: Number(rzp.amount),
      method: rzp.method,
      signatureVerified: true,
      source: "checkout",
    });
    return { ok: true, orderNumber: payment.order.number };
  } catch (err) {
    console.error("[razorpay:verify]", err);
    return { ok: false, error: "We couldn't confirm the payment right now. Your order will update automatically once Razorpay confirms it." };
  }
}

/** Failure info from the browser is only used to show a failed state – it can never mark anything paid. */
export async function reportPaymentFailureAction(providerOrderId: string, code?: string, description?: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const payment = await db.payment.findUnique({ where: { providerOrderId: String(providerOrderId).slice(0, 64) }, include: { order: true } });
  if (!payment || payment.order.userId !== user.id) return;
  await markPaymentFailed(payment.providerOrderId, code, description);
}

export async function cancelOrderAction(orderNumber: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };
  const order = await db.order.findFirst({ where: { number: orderNumber, userId: user.id } });
  if (!order) return { ok: false, message: "Order not found." };

  if (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED") {
    await setOrderStatus(order.id, "CANCELLED", "Cancelled by customer before payment", user.id);
    return { ok: true, message: "Your order has been cancelled." };
  }
  if ((order.status === "CONFIRMED" || order.status === "PROCESSING") && order.paymentMethod === "COD") {
    await setOrderStatus(order.id, "CANCELLED", "Cancelled by customer", user.id);
    return { ok: true, message: "Your order has been cancelled." };
  }
  if (order.status === "CONFIRMED" || order.status === "PROCESSING") {
    await db.$transaction([
      db.order.update({ where: { id: order.id }, data: { status: "CANCEL_REQUESTED" } }),
      db.orderStatusHistory.create({ data: { orderId: order.id, status: "CANCEL_REQUESTED", note: "Customer requested cancellation", byUserId: user.id } }),
    ]);
    return { ok: true, message: "Cancellation requested. We'll confirm and process your refund shortly." };
  }
  return { ok: false, message: "This order can no longer be cancelled." };
}
