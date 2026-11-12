"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getCart, ensureCartId } from "@/server/cart";
import { createOrder, customerCancel, hashGuestToken, OrderError, quoteCart, submitBankTransfer, type Quote } from "@/server/orders";
import { addressSchema } from "@/server/validation";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { uploadMedia } from "@/server/media";
import { toPaise } from "@/lib/money";

const methodSchema = z.enum(["BANK_TRANSFER", "COD"]);
const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/);

export type QuoteInput = { pincode?: string | null; state?: string | null; method?: "BANK_TRANSFER" | "COD" | null; email?: string | null };

async function quoteFor(input: QuoteInput, couponCode: string | null): Promise<Quote> {
  const user = await getCurrentUser();
  const pin = pincodeSchema.safeParse(input.pincode ?? "");
  return quoteCart({
    cart: await getCart(),
    couponCode,
    pincode: pin.success ? pin.data : null,
    state: input.state ? String(input.state).slice(0, 60) : null,
    method: methodSchema.safeParse(input.method).success ? (input.method as "BANK_TRANSFER" | "COD") : null,
    userId: user?.id ?? null,
    email: user?.email ?? (z.string().email().safeParse(input.email).success ? String(input.email) : null),
  });
}

/** Re-prices the cart on the server whenever the PIN, state or payment method changes. */
export async function quoteAction(input: QuoteInput): Promise<Quote> {
  const cart = await getCart();
  return quoteFor(input, cart.couponCode);
}

export async function applyCouponAction(code: string, input: QuoteInput): Promise<{ ok: boolean; error?: string; quote: Quote }> {
  const limited = await rateLimit("coupon", 20, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: "Too many attempts – please wait a moment.", quote: await quoteAction(input) };
  const normalised = String(code).trim().toUpperCase().slice(0, 40);
  if (!normalised) return { ok: false, error: "Enter a coupon code", quote: await quoteAction(input) };
  const quote = await quoteFor(input, normalised);
  const cartId = await ensureCartId();
  await db.cart.update({ where: { id: cartId }, data: { couponCode: quote.coupon ? quote.coupon.code : null } });
  if (!quote.coupon) return { ok: false, error: quote.couponError ?? "This coupon is not valid.", quote: await quoteFor(input, null) };
  return { ok: true, quote };
}

export async function removeCouponAction(input: QuoteInput): Promise<Quote> {
  const cartId = await ensureCartId();
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  return quoteFor(input, null);
}

export type PlaceOrderResult = { ok: true; url: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; quote?: Quote };

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
});

const placeOrderSchema = z.object({
  contact: contactSchema.optional(),
  addressId: z.string().cuid().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().default(false),
  method: methodSchema,
  expectedTotalPaise: z.number().int().min(0),
  deliveryInstructions: z.string().trim().max(300).optional(),
  note: z.string().trim().max(500).optional(),
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
});

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const limited = await rateLimit("checkout", 10, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: "Too many attempts – please wait a few minutes." };
  const user = await getCurrentUser();

  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path.slice(-1)[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const email = user?.email ?? data.contact?.email;
  if (!email) return { ok: false, error: "Enter your email address.", fieldErrors: { email: "Enter a valid email address" } };

  let address = data.address;
  if (data.addressId) {
    if (!user) return { ok: false, error: "Please enter a delivery address." };
    const saved = await db.address.findFirst({ where: { id: data.addressId, userId: user.id } });
    if (!saved) return { ok: false, error: "Please choose a delivery address." };
    address = { ...saved, state: saved.state as NonNullable<typeof address>["state"] };
  }
  if (!address) return { ok: false, error: "Please add a delivery address." };

  const cart = await getCart();
  try {
    const { order, guestToken } = await createOrder({
      user: user ? { id: user.id, email: user.email } : null,
      email,
      cart,
      couponCode: cart.couponCode,
      address,
      method: data.method,
      expectedTotalPaise: data.expectedTotalPaise,
      note: data.note,
      deliveryInstructions: data.deliveryInstructions,
    });
    if (user && data.saveAddress && data.address) {
      const count = await db.address.count({ where: { userId: user.id } });
      if (count < 20) await db.address.create({ data: { ...data.address, userId: user.id, isDefault: count === 0 } });
    }
    if (guestToken) {
      // Lets the same browser reopen the order without the emailed link.
      (await cookies()).set(`dz_go_${order.number}`, guestToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return { ok: true, url: `/order/${order.number}?placed=1` };
    }
    return { ok: true, url: `/account/orders/${order.number}?placed=1` };
  } catch (err) {
    if (err instanceof OrderError) {
      const quote = await quoteFor({ pincode: address.pincode, state: address.state, method: data.method, email }, (await getCart()).couponCode);
      return { ok: false, error: err.message, quote };
    }
    console.error("[checkout:create]", err);
    return { ok: false, error: "We couldn't place your order right now. Nothing was charged – please try again." };
  }
}

// ─────────────────────────── Order access (customer or guest link) ───────────────────────────

/** Resolves an order the current visitor may act on: owner account, or a guest holding the order's secret. */
export async function findAccessibleOrder(number: string, guestKey?: string | null) {
  const n = String(number).slice(0, 40);
  const user = await getCurrentUser();
  const order = await db.order.findUnique({ where: { number: n } });
  if (!order) return null;
  if (user && order.userId === user.id) return order;
  const key = guestKey || (await cookies()).get(`dz_go_${n}`)?.value;
  if (key && order.guestAccessHash && order.guestAccessHash === hashGuestToken(key)) return order;
  return null;
}

export async function cancelOrderAction(orderNumber: string, reason: string, guestKey?: string): Promise<{ ok: boolean; message: string }> {
  const order = await findAccessibleOrder(orderNumber, guestKey);
  if (!order) return { ok: false, message: "Order not found." };
  const why = String(reason || "").trim().slice(0, 300) || "No reason given";
  try {
    const user = await getCurrentUser();
    const res = await customerCancel(order.id, user?.id ?? null, why);
    return { ok: true, message: res === "cancelled" ? "Your order has been cancelled." : "Cancellation requested – we'll confirm shortly." };
  } catch (err) {
    return { ok: false, message: err instanceof OrderError ? err.message : "Could not cancel this order." };
  }
}

const transferSchema = z.object({
  reference: z.string().trim().min(4, "Enter the UTR / transaction reference").max(60).regex(/^[A-Za-z0-9\-/ ]+$/, "Letters, digits, dashes and slashes only"),
  amount: z.coerce.number().positive("Enter the amount you paid").max(10_000_000),
  paidOn: z.string().trim().optional(),
  payerName: z.string().trim().max(80).optional(),
});

export type TransferState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

export async function submitTransferAction(_prev: TransferState, form: FormData): Promise<TransferState> {
  const limited = await rateLimit("transfer", 10, 60 * 60_000);
  if (!limited.ok) return { error: "Too many submissions – please try again later." };
  const order = await findAccessibleOrder(String(form.get("orderNumber") ?? ""), String(form.get("k") ?? "") || null);
  if (!order) return { error: "Order not found." };
  const parsed = transferSchema.safeParse({
    reference: form.get("reference"),
    amount: form.get("amount"),
    paidOn: form.get("paidOn") || undefined,
    payerName: form.get("payerName") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  let proofKey: string | null = null;
  const file = form.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return { error: "The screenshot is larger than 8 MB." };
    try {
      proofKey = (await uploadMedia(Buffer.from(await file.arrayBuffer()), "private/payment-proofs", { isPrivate: true })).key;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not upload the screenshot." };
    }
  }
  const paidOn = parsed.data.paidOn ? new Date(parsed.data.paidOn) : null;
  try {
    await submitBankTransfer(order.id, {
      reference: parsed.data.reference.toUpperCase(),
      amountPaise: toPaise(parsed.data.amount.toFixed(2)),
      paidOn: paidOn && !Number.isNaN(paidOn.getTime()) ? paidOn : null,
      payerName: parsed.data.payerName || null,
      proofKey,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Could not save your payment details – please try again." };
  }
}
