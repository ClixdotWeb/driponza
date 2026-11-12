import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";
import { getSettings, shippingFor } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { razorpay } from "@/lib/razorpay";
import type { CartView } from "@/server/cart";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// ─────────────────────────── Pricing & coupons ───────────────────────────

export type Pricing = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  coupon: { id: string; code: string } | null;
  couponError: string | null;
};

export async function validateCoupon(code: string, subtotalPaise: number, userId: string | null) {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false as const, error: "Enter a coupon code" };
  const coupon = await db.coupon.findUnique({ where: { code: normalised } });
  const now = new Date();
  if (!coupon || !coupon.isActive) return { ok: false as const, error: "This coupon is not valid." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false as const, error: "This coupon is not active yet." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false as const, error: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { ok: false as const, error: "This coupon has been fully redeemed." };
  const min = coupon.minSubtotal ? toPaise(coupon.minSubtotal) : 0;
  if (subtotalPaise < min) return { ok: false as const, error: `Spend at least ${formatINR(min)} to use this coupon.` };
  if (coupon.perUserLimit !== null && userId) {
    const used = await db.order.count({ where: { userId, couponId: coupon.id, paymentStatus: { in: ["PAID", "NOT_REQUIRED"] } } });
    if (used >= coupon.perUserLimit) return { ok: false as const, error: "You have already used this coupon." };
  }
  let discount =
    coupon.type === "PERCENT" ? Math.floor((subtotalPaise * Number(coupon.value)) / 100) : toPaise(coupon.value);
  if (coupon.maxDiscount) discount = Math.min(discount, toPaise(coupon.maxDiscount));
  discount = Math.max(0, Math.min(discount, subtotalPaise));
  return { ok: true as const, coupon, discountPaise: discount };
}

export async function priceCart(cart: CartView, couponCode: string | null, userId: string | null): Promise<Pricing> {
  const { commerce } = await getSettings();
  const subtotal = cart.subtotalPaise;
  let discount = 0;
  let coupon: Pricing["coupon"] = null;
  let couponError: string | null = null;
  if (couponCode) {
    const result = await validateCoupon(couponCode, subtotal, userId);
    if (result.ok) {
      discount = result.discountPaise;
      coupon = { id: result.coupon.id, code: result.coupon.code };
    } else couponError = result.error;
  }
  const shipping = shippingFor(subtotal - discount, commerce);
  return { subtotalPaise: subtotal, discountPaise: discount, shippingPaise: shipping, totalPaise: subtotal - discount + shipping, coupon, couponError };
}

// ─────────────────────────── Order creation ───────────────────────────

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(5), (b) => alphabet[b % alphabet.length]).join("");
  return `DZ-${ymd}-${rand}`;
}

export type ShippingAddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  district?: string | null;
  state: string;
  pincode: string;
};

export async function createOrderFromCart(args: {
  user: { id: string; email: string; name: string };
  cart: CartView;
  pricing: Pricing;
  address: ShippingAddressInput;
  method: "RAZORPAY" | "COD";
  note?: string | null;
}) {
  const { user, cart, pricing, address, method } = args;
  const lines = cart.lines.filter((l) => !l.problem);
  if (!lines.length) throw new Error("Your cart is empty");

  return db.$transaction(async (tx) => {
    // Re-check stock inside the transaction using current values.
    const variants = await tx.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.variantId) } },
      select: { id: true, stock: true, sku: true, price: true, isActive: true },
    });
    for (const line of lines) {
      const v = variants.find((x) => x.id === line.variantId);
      if (!v || !v.isActive) throw new Error(`${line.name} is no longer available`);
      if (v.stock < line.quantity) throw new Error(`Only ${v.stock} × ${line.name} (${line.variantLabel}) left in stock`);
      if (toPaise(v.price) !== line.unitPricePaise) throw new Error("Prices changed while you were checking out – please review your cart");
    }

    const isCod = method === "COD";
    let number = newOrderNumber();
    while (await tx.order.findUnique({ where: { number }, select: { id: true } })) number = newOrderNumber();

    const order = await tx.order.create({
      data: {
        number,
        userId: user.id,
        email: user.email,
        customerName: address.fullName,
        phone: address.phone,
        paymentMethod: method,
        status: isCod ? "CONFIRMED" : "PENDING_PAYMENT",
        paymentStatus: isCod ? "NOT_REQUIRED" : "PENDING",
        subtotal: paiseToDecimalString(pricing.subtotalPaise),
        discount: paiseToDecimalString(pricing.discountPaise),
        shipping: paiseToDecimalString(pricing.shippingPaise),
        total: paiseToDecimalString(pricing.totalPaise),
        couponId: pricing.coupon?.id ?? null,
        couponCode: pricing.coupon?.code ?? null,
        shipName: address.fullName,
        shipPhone: address.phone,
        shipLine1: address.line1,
        shipLine2: address.line2 || null,
        shipLandmark: address.landmark || null,
        shipCity: address.city,
        shipDistrict: address.district || null,
        shipState: address.state,
        shipPincode: address.pincode,
        customerNote: args.note || null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.name,
            productSlug: l.productSlug,
            variantLabel: l.variantLabel,
            sku: variants.find((v) => v.id === l.variantId)!.sku,
            imageUrl: l.image,
            unitPrice: paiseToDecimalString(l.unitPricePaise),
            quantity: l.quantity,
            lineTotal: paiseToDecimalString(l.lineTotalPaise),
          })),
        },
        history: {
          create: {
            status: isCod ? "CONFIRMED" : "PENDING_PAYMENT",
            note: isCod ? "Order placed – cash on delivery" : "Order created – awaiting online payment",
            byUserId: user.id,
          },
        },
      },
      include: { items: true },
    });

    if (isCod) {
      // No payment to verify for COD, so stock is committed when the order is confirmed.
      await applyStock(tx, order.id, user.id);
      if (order.couponId) await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
      await clearOrderedFromCart(tx, user.id, order.items.map((i) => i.variantId!).filter(Boolean));
    }
    return order;
  });
}

// ─────────────────────────── Stock ───────────────────────────

/** Reduces stock for every item. Returns false (and flags the order) if any line could not be fulfilled. */
async function applyStock(tx: Tx, orderId: string, userId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.stockApplied) return true;
  let allOk = true;
  for (const item of order.items) {
    if (!item.variantId) continue;
    const res = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) {
      allOk = false;
      continue;
    }
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: item.variantId, change: -item.quantity, stockAfter: v.stock, reason: "SALE", orderId, userId, note: order.number },
    });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockApplied: true, stockIssue: !allOk } });
  return allOk;
}

export async function restockOrder(tx: Tx, orderId: string, byUserId: string | null, reason: "CANCELLATION" | "RETURN") {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, movements: { where: { reason: "SALE" } } } });
  if (!order.stockApplied) return;
  for (const move of order.movements) {
    const v = await tx.productVariant.update({ where: { id: move.variantId }, data: { stock: { increment: -move.change } } });
    await tx.inventoryMovement.create({
      data: { variantId: move.variantId, change: -move.change, stockAfter: v.stock, reason, orderId, userId: byUserId, note: order.number },
    });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockApplied: false } });
}

async function clearOrderedFromCart(tx: Tx, userId: string | null, variantIds: string[]) {
  if (!userId || !variantIds.length) return;
  const cart = await tx.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId: { in: variantIds } } });
  await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
}

// ─────────────────────────── Payments ───────────────────────────

/** Deterministic problem (retrying won't help) – the order is put on hold for an admin. */
export class PaymentMismatchError extends Error {}

/**
 * Marks an order paid after a *server-verified* Razorpay payment (checkout signature + API check, or signed webhook).
 * Idempotent: concurrent/duplicate calls only apply stock & coupon usage once.
 */
export async function markOrderPaid(args: {
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  method?: string | null;
  signatureVerified?: boolean;
  source: "checkout" | "webhook";
}) {
  // Checked outside the transaction so the "on hold" flag is not rolled back with it.
  const expected = await db.payment.findUnique({ where: { providerOrderId: args.providerOrderId }, select: { orderId: true, amountPaise: true } });
  if (!expected) throw new Error(`Unknown Razorpay order ${args.providerOrderId}`);
  if (args.amountPaise !== expected.amountPaise) {
    const note = `Amount mismatch: expected ${expected.amountPaise} paise, Razorpay reported ${args.amountPaise} (payment ${args.providerPaymentId}). Not marked paid.`;
    await db.$transaction([
      db.order.update({ where: { id: expected.orderId }, data: { status: "ON_HOLD", adminNote: note } }),
      db.orderStatusHistory.create({ data: { orderId: expected.orderId, status: "ON_HOLD", note } }),
    ]);
    throw new PaymentMismatchError(note);
  }

  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { providerOrderId: args.providerOrderId }, include: { order: true } });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: args.providerPaymentId,
        status: "CAPTURED",
        method: args.method ?? payment.method,
        capturedAt: payment.capturedAt ?? new Date(),
        signatureVerified: payment.signatureVerified || Boolean(args.signatureVerified),
        errorCode: null,
        errorDescription: null,
      },
    });

    // The guard on paymentStatus makes this the single "winner" even under concurrent calls.
    const claimed = await tx.order.updateMany({
      where: { id: payment.orderId, paymentStatus: { in: ["PENDING", "FAILED"] } },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return { orderId: payment.orderId, firstTime: false };

    const wasCancelled = payment.order.status === "CANCELLED";
    const stockOk = wasCancelled ? true : await applyStock(tx, payment.orderId, payment.order.userId);
    const status: OrderStatus = wasCancelled || !stockOk ? "ON_HOLD" : "CONFIRMED";
    const note = wasCancelled
      ? "Payment received after the order was cancelled – refund or re-open"
      : !stockOk
        ? "Paid, but stock was insufficient for some items – restock or refund"
        : `Payment verified via ${args.source}`;
    await tx.order.update({ where: { id: payment.orderId }, data: { status } });
    await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, status, note } });
    if (payment.order.couponId) await tx.coupon.update({ where: { id: payment.order.couponId }, data: { usedCount: { increment: 1 } } });
    const items = await tx.orderItem.findMany({ where: { orderId: payment.orderId }, select: { variantId: true } });
    await clearOrderedFromCart(tx, payment.order.userId, items.map((i) => i.variantId!).filter(Boolean));
    return { orderId: payment.orderId, firstTime: true };
  });

  if (result.firstTime) await sendOrderConfirmation(result.orderId);
  return result;
}

export async function markPaymentFailed(providerOrderId: string, code?: string | null, description?: string | null) {
  const payment = await db.payment.findUnique({ where: { providerOrderId } });
  if (!payment || payment.status === "CAPTURED") return;
  await db.$transaction([
    db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", errorCode: code?.slice(0, 100) ?? null, errorDescription: description?.slice(0, 500) ?? null } }),
    db.order.updateMany({ where: { id: payment.orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED", status: "PAYMENT_FAILED" } }),
  ]);
}

/** Creates a Razorpay order for an existing unpaid order (first attempt or retry). */
export async function createRazorpayOrderFor(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!["PENDING", "FAILED"].includes(order.paymentStatus)) throw new Error("This order is not awaiting payment");
  const amountPaise = toPaise(order.total);
  const rzpOrder = await razorpay().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: order.number,
    notes: { orderId: order.id, orderNumber: order.number },
  });
  await db.payment.create({ data: { orderId: order.id, providerOrderId: rzpOrder.id, amountPaise, currency: "INR" } });
  if (order.status === "PAYMENT_FAILED") {
    await db.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT", paymentStatus: "PENDING" } });
  }
  return { order, razorpayOrderId: rzpOrder.id, amountPaise };
}

/** Records a refund once, whether it is first seen from our API call or from a webhook. */
export async function recordRefund(args: {
  paymentId: string;
  providerRefundId: string;
  amountPaise: number;
  status: "PENDING" | "PROCESSED" | "FAILED";
  reason?: string | null;
  createdById?: string | null;
}) {
  await db.$transaction(async (tx) => {
    const existing = await tx.refund.findUnique({ where: { providerRefundId: args.providerRefundId } });
    if (existing) {
      if (existing.status !== args.status) await tx.refund.update({ where: { id: existing.id }, data: { status: args.status } });
      return;
    }
    await tx.refund.create({
      data: { paymentId: args.paymentId, providerRefundId: args.providerRefundId, amountPaise: args.amountPaise, status: args.status, reason: args.reason, createdById: args.createdById },
    });
    if (args.status === "FAILED") return;
    const payment = await tx.payment.update({ where: { id: args.paymentId }, data: { refundedPaise: { increment: args.amountPaise } } });
    const full = payment.refundedPaise >= payment.amountPaise;
    await tx.payment.update({ where: { id: payment.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED", ...(full ? { status: "REFUNDED" } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        status: full ? "REFUNDED" : (await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status,
        note: `${full ? "Full" : "Partial"} refund of ${formatINR(args.amountPaise)}${args.reason ? ` – ${args.reason}` : ""}`,
        byUserId: args.createdById ?? null,
      },
    });
  });
}

// ─────────────────────────── Status changes ───────────────────────────

export async function setOrderStatus(orderId: string, status: OrderStatus, note: string | null, byUserId: string | null) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const data: Prisma.OrderUpdateInput = { status };
    if (status === "CANCELLED") {
      data.cancelledAt = new Date();
      await restockOrder(tx, orderId, byUserId, "CANCELLATION");
      if (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") data.paymentStatus = "FAILED";
    }
    if (status === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus === "NOT_REQUIRED") {
      data.paymentStatus = "PAID";
      data.paidAt = new Date();
    }
    if (status === "SHIPPED") await tx.shipment.upsert({ where: { orderId }, create: { orderId, shippedAt: new Date() }, update: { shippedAt: new Date() } });
    if (status === "DELIVERED") await tx.shipment.upsert({ where: { orderId }, create: { orderId, deliveredAt: new Date() }, update: { deliveredAt: new Date() } });
    await tx.order.update({ where: { id: orderId }, data });
    await tx.orderStatusHistory.create({ data: { orderId, status, note, byUserId } });
  });
  if (status === "SHIPPED" || status === "DELIVERED" || status === "CANCELLED") await sendStatusEmail(orderId);
}

// ─────────────────────────── Emails ───────────────────────────

async function sendOrderConfirmation(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const lines = order.items.map((i) => `• ${i.productName} (${i.variantLabel}) × ${i.quantity} — ${formatINR(toPaise(i.lineTotal))}`).join("\n");
  await sendEmail(
    order.email,
    `Order ${order.number} confirmed – Driponza`,
    `Hello ${order.customerName},\n\nThank you for your order! Here is your summary:\n\n${lines}\n\nTotal: ${formatINR(toPaise(order.total))}\n\nTrack your order: ${process.env.APP_URL ?? ""}/account/orders/${order.number}\n\n— Driponza`,
  );
}

async function sendStatusEmail(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) return;
  const tracking = order.shipment?.trackingNumber
    ? `\nCarrier: ${order.shipment.carrier ?? "-"}\nTracking number: ${order.shipment.trackingNumber}${order.shipment.trackingUrl ? `\nTrack: ${order.shipment.trackingUrl}` : ""}\n`
    : "";
  const label = { SHIPPED: "has been shipped", DELIVERED: "has been delivered", CANCELLED: "has been cancelled" }[order.status as string] ?? `is now ${order.status}`;
  await sendEmail(
    order.email,
    `Order ${order.number} ${label}`,
    `Hello ${order.customerName},\n\nYour Driponza order ${order.number} ${label}.\n${tracking}\nView your order: ${process.env.APP_URL ?? ""}/account/orders/${order.number}\n\n— Driponza`,
  );
}
