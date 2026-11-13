import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";
import { bankTransferReady, getSettings, type Settings } from "@/lib/settings";
import { randomToken } from "@/lib/auth/tokens";
import {
  computeTotals,
  evaluateCoupon,
  matchZone,
  type CouponResult,
  type CouponRule,
  type PricingLine,
  type Totals,
  type ZoneRule,
} from "@/lib/pricing";
import {
  canTransition,
  CUSTOMER_CAN_CANCEL,
  ORDER_STATUS_LABEL,
  paymentStatusAfterReceipt,
  paymentStatusAfterRefund,
  PRE_SHIPMENT,
  REQUIRES_PAYMENT,
} from "@/lib/order-status";
import { notify, adminEmail } from "@/server/notify";
import { audit } from "@/server/audit";
import type { CartView } from "@/server/cart";
import type { OrderStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
export type CheckoutMethod = "BANK_TRANSFER" | "COD";

/** Business-rule failure with a message that is safe to show to the user. */
export class OrderError extends Error {}

const appUrl = () => process.env.APP_URL ?? "";

// ─────────────────────────── Shipping zones & coupons ───────────────────────────

export async function loadZones(commerce: Settings["commerce"]): Promise<ZoneRule[]> {
  const zones = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
  if (zones.length) return zones;
  // No zones configured yet: the legacy flat-rate settings act as one all-India zone.
  return [
    {
      id: "default",
      name: "All India",
      pincodePrefixes: [],
      states: [],
      ratePaise: commerce.shippingFlatPaise,
      freeAbovePaise: commerce.freeShippingAbovePaise,
      codAllowed: commerce.codEnabled,
      codChargePaise: commerce.codChargePaise,
      minDays: 3,
      maxDays: 7,
    },
  ];
}

async function loadCouponRule(code: string): Promise<CouponRule | null> {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minSubtotalPaise: c.minSubtotal ? toPaise(c.minSubtotal) : 0,
    maxDiscountPaise: c.maxDiscount ? toPaise(c.maxDiscount) : null,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    perUserLimit: c.perUserLimit,
    firstOrderOnly: c.firstOrderOnly,
    productIds: c.productIds,
    categoryIds: c.categoryIds,
    isActive: c.isActive,
  };
}

async function customerHistory(couponId: string | null, who: { userId: string | null; email: string | null }) {
  const ors: Prisma.OrderWhereInput[] = [];
  if (who.userId) ors.push({ userId: who.userId });
  if (who.email) ors.push({ email: who.email.toLowerCase() });
  if (!ors.length) return { customerUses: 0, customerOrders: 0 };
  const [customerOrders, customerUses] = await Promise.all([
    db.order.count({ where: { OR: ors, status: { notIn: ["CANCELLED"] } } }),
    couponId
      ? db.couponUsage.count({ where: { couponId, OR: [...(who.userId ? [{ userId: who.userId }] : []), ...(who.email ? [{ email: who.email.toLowerCase() }] : [])] } })
      : 0,
  ]);
  return { customerUses, customerOrders };
}

function pricingLines(cart: CartView): PricingLine[] {
  return cart.lines
    .filter((l) => !l.problem)
    .map((l) => ({ productId: l.productId, categoryId: l.categoryId, lineTotalPaise: l.lineTotalPaise, taxRatePercent: l.taxRatePercent }));
}

export type Quote = {
  totals: Totals;
  coupon: { id: string; code: string } | null;
  couponError: string | null;
  zone: { id: string; name: string; minDays: number; maxDays: number } | null;
  serviceable: boolean;
  methods: { BANK_TRANSFER: { available: boolean; reason?: string }; COD: { available: boolean; reason?: string } };
};

/** Server-side price quote. Never trusts amounts from the browser. */
export async function quoteCart(args: {
  cart: CartView;
  couponCode: string | null;
  pincode: string | null;
  state: string | null;
  method: CheckoutMethod | null;
  userId: string | null;
  email: string | null;
}): Promise<Quote> {
  const settings = await getSettings();
  const lines = pricingLines(args.cart);

  let couponRes: CouponResult | null = null;
  let coupon: Quote["coupon"] = null;
  if (args.couponCode) {
    const rule = await loadCouponRule(args.couponCode);
    const history = await customerHistory(rule?.id ?? null, { userId: args.userId, email: args.email });
    couponRes = evaluateCoupon(rule, lines, { now: new Date(), ...history });
    if (couponRes.ok && rule) coupon = { id: rule.id, code: rule.code };
  }

  const zones = await loadZones(settings.commerce);
  const zone = args.pincode ? matchZone(zones, args.pincode, args.state) : null;
  const totals = computeTotals({ lines, coupon: couponRes, zone, method: args.method });

  const bankOk = bankTransferReady(settings);
  let cod: Quote["methods"]["COD"] = { available: true };
  if (!settings.commerce.codEnabled) cod = { available: false, reason: "Cash on delivery is not offered." };
  else if (zone && !zone.codAllowed) cod = { available: false, reason: "Cash on delivery isn't available for this PIN code." };
  else if (settings.commerce.codMaxOrderPaise !== null && totals.totalPaise > settings.commerce.codMaxOrderPaise)
    cod = { available: false, reason: `Cash on delivery is available up to ${formatINR(settings.commerce.codMaxOrderPaise)}.` };

  return {
    totals,
    coupon,
    couponError: couponRes && !couponRes.ok ? couponRes.error : null,
    zone: zone ? { id: zone.id, name: zone.name, minDays: zone.minDays, maxDays: zone.maxDays } : null,
    serviceable: args.pincode ? Boolean(zone) : true,
    methods: {
      BANK_TRANSFER: bankOk ? { available: true } : { available: false, reason: "Bank transfer is not set up yet." },
      COD: cod,
    },
  };
}

// ─────────────────────────── Order creation ───────────────────────────

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(5), (b) => alphabet[b % alphabet.length]).join("");
  return `DZ-${ymd}-${rand}`;
}

export const hashGuestToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

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

export async function createOrder(args: {
  user: { id: string; email: string } | null;
  email: string;
  cart: CartView;
  couponCode: string | null;
  address: ShippingAddressInput;
  method: CheckoutMethod;
  /** Total the customer saw – if the server total differs we stop and ask them to review. */
  expectedTotalPaise: number;
  note?: string | null;
  deliveryInstructions?: string | null;
}) {
  const settings = await getSettings();
  const { cart, address, method } = args;
  // Problems first: an item that just sold out must not be reported as an "empty cart".
  if (cart.hasProblems) {
    const p = cart.lines.find((l) => l.problem)!;
    throw new OrderError(`${p.name} (${p.variantLabel}): ${p.problem!.toLowerCase()} – please review your cart.`);
  }
  const lines = cart.lines;
  if (!lines.length) throw new OrderError("Your cart is empty.");
  if (lines.some((l) => l.quantity > settings.commerce.maxQtyPerLine)) throw new OrderError(`You can order at most ${settings.commerce.maxQtyPerLine} of each item.`);

  const email = args.email.trim().toLowerCase();
  const quote = await quoteCart({
    cart,
    couponCode: args.couponCode,
    pincode: address.pincode,
    state: address.state,
    method,
    userId: args.user?.id ?? null,
    email,
  });
  if (args.couponCode && quote.couponError) throw new OrderError(quote.couponError);
  if (!quote.serviceable) throw new OrderError("Sorry, we don't deliver to this PIN code yet.");
  if (!quote.methods[method].available) throw new OrderError(quote.methods[method].reason ?? "This payment method is not available.");
  if (quote.totals.subtotalPaise - quote.totals.discountPaise < settings.commerce.minOrderPaise)
    throw new OrderError(`The minimum order value is ${formatINR(settings.commerce.minOrderPaise)}.`);
  if (quote.totals.totalPaise < 100) throw new OrderError("Order total must be at least ₹1.");
  if (quote.totals.totalPaise !== args.expectedTotalPaise) throw new OrderError("Your order total changed – please review the updated summary and place the order again.");

  const guestToken = args.user ? null : randomToken(24);
  const isCod = method === "COD";
  const status: OrderStatus = isCod ? "CONFIRMED" : "AWAITING_PAYMENT";

  const order = await db.$transaction(async (tx) => {
    // 1. Claim the cart lines. A concurrent duplicate submit blocks here and then finds nothing to claim.
    if (!cart.id) throw new OrderError("Your cart is empty.");
    const claimed = await tx.cartItem.deleteMany({ where: { cartId: cart.id, id: { in: lines.map((l) => l.id) } } });
    if (claimed.count !== lines.length) throw new OrderError("This order was already placed or your cart changed – please check your orders or cart.");

    // 2. Re-check price and availability with current DB values.
    const variants = await tx.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.variantId) } },
      select: { id: true, sku: true, price: true, isActive: true },
    });
    for (const line of lines) {
      const v = variants.find((x) => x.id === line.variantId);
      if (!v || !v.isActive) throw new OrderError(`${line.name} is no longer available.`);
      if (toPaise(v.price) !== line.unitPricePaise) throw new OrderError("Prices changed while you were checking out – please review your cart.");
    }

    let number = newOrderNumber();
    while (await tx.order.findUnique({ where: { number }, select: { id: true } })) number = newOrderNumber();

    const created = await tx.order.create({
      data: {
        number,
        userId: args.user?.id ?? null,
        guestAccessHash: guestToken ? hashGuestToken(guestToken) : null,
        email,
        customerName: address.fullName,
        phone: address.phone,
        paymentMethod: method,
        status,
        paymentStatus: "UNPAID",
        subtotal: paiseToDecimalString(quote.totals.subtotalPaise),
        discount: paiseToDecimalString(quote.totals.discountPaise),
        shipping: paiseToDecimalString(quote.totals.shippingPaise),
        codCharge: paiseToDecimalString(quote.totals.codChargePaise),
        taxTotal: paiseToDecimalString(quote.totals.taxPaise),
        total: paiseToDecimalString(quote.totals.totalPaise),
        shippingZoneId: quote.zone && quote.zone.id !== "default" ? quote.zone.id : null,
        couponId: quote.coupon?.id ?? null,
        couponCode: quote.coupon?.code ?? null,
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
        deliveryInstructions: args.deliveryInstructions || null,
        paymentDueAt: isCod ? null : new Date(Date.now() + settings.commerce.bankTransferHoldHours * 3600_000),
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
            taxRatePercent: l.taxRatePercent === null ? null : String(l.taxRatePercent),
            hsnCode: l.hsnCode,
          })),
        },
        history: {
          create: {
            status,
            note: isCod ? "Order placed – cash on delivery" : "Order placed – awaiting bank transfer",
            byUserId: args.user?.id ?? null,
          },
        },
      },
    });

    // 3. Reserve stock atomically – fails the whole order if any line can't be covered.
    await reserveStock(tx, created.id, args.user?.id ?? null);

    // 4. Coupon usage – unique per order, so it can never be counted twice.
    if (quote.coupon) {
      const c = await tx.coupon.findUniqueOrThrow({ where: { id: quote.coupon.id }, select: { usageLimit: true } });
      // Conditional increment = no over-redemption even under concurrent checkouts.
      const bumped = await tx.coupon.updateMany({
        where: { id: quote.coupon.id, isActive: true, ...(c.usageLimit !== null ? { usedCount: { lt: c.usageLimit } } : {}) },
        data: { usedCount: { increment: 1 } },
      });
      if (bumped.count === 0) throw new OrderError("This coupon has just been fully redeemed.");
      await tx.couponUsage.create({ data: { couponId: quote.coupon.id, orderId: created.id, userId: args.user?.id ?? null, email } });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return created;
  });

  await sendOrderPlaced(order.id, guestToken);
  return { order, guestToken };
}

// ─────────────────────────── Stock ───────────────────────────

/** Decrements stock for every line inside the order transaction (all-or-nothing). Idempotent via `stockApplied`. */
async function reserveStock(tx: Tx, orderId: string, userId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.stockApplied) return;
  for (const item of order.items) {
    if (!item.variantId) continue;
    const res = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) {
      const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } });
      throw new OrderError(
        v && v.stock > 0
          ? `Only ${v.stock} × ${item.productName} (${item.variantLabel}) left in stock.`
          : `${item.productName} (${item.variantLabel}) just sold out.`,
      );
    }
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: item.variantId, change: -item.quantity, stockAfter: v.stock, reason: "SALE", orderId, userId, note: order.number },
    });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockApplied: true } });
}

/** Puts reserved stock back (cancellation / expiry). Only reverses movements this order actually made. */
export async function releaseStock(tx: Tx, orderId: string, byUserId: string | null, reason: "CANCELLATION" | "RESERVATION_RELEASE") {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { movements: { where: { reason: "SALE" } } } });
  if (!order.stockApplied) return;
  for (const move of order.movements) {
    const v = await tx.productVariant.update({ where: { id: move.variantId }, data: { stock: { increment: -move.change } } });
    await tx.inventoryMovement.create({
      data: { variantId: move.variantId, change: -move.change, stockAfter: v.stock, reason, orderId, userId: byUserId, note: order.number },
    });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockApplied: false } });
}

/** First-expiry-first-out batch allocation when goods leave the warehouse (traceability only). */
async function allocateBatches(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } }, include: { batches: true } });
  for (const item of items) {
    let need = item.quantity - item.batches.reduce((n, b) => n + b.quantity, 0);
    if (need <= 0) continue;
    const batches = await tx.inventoryBatch.findMany({
      where: { variantId: item.variantId!, status: "ACTIVE", quantityRemaining: { gt: 0 } },
      orderBy: [{ bestBefore: { sort: "asc", nulls: "last" } }, { purchasedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
    for (const b of batches) {
      if (need <= 0) break;
      const take = Math.min(need, b.quantityRemaining);
      const left = b.quantityRemaining - take;
      await tx.inventoryBatch.update({ where: { id: b.id }, data: { quantityRemaining: left, status: left === 0 ? "DEPLETED" : "ACTIVE" } });
      await tx.orderItemBatch.create({ data: { orderItemId: item.id, batchId: b.id, quantity: take } });
      need -= take;
    }
  }
}

// ─────────────────────────── Status changes ───────────────────────────

const CUSTOMER_EMAIL_STATUSES: OrderStatus[] = [
  "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "DELIVERY_FAILED", "RETURNED", "REFUNDED",
];

/**
 * The only way to change an order's status. Enforces the transition map and payment rules,
 * applies stock side effects and writes history + audit inside one transaction.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  opts: { note?: string | null; actorId: string | null; system?: boolean; tx?: Tx } = { actorId: null },
) {
  const run = async (tx: Tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!canTransition(order.status, to)) {
      throw new OrderError(`Can't move an order from "${ORDER_STATUS_LABEL[order.status]}" to "${ORDER_STATUS_LABEL[to]}".`);
    }
    if (order.paymentMethod === "BANK_TRANSFER" && REQUIRES_PAYMENT.includes(to) && order.paymentStatus !== "PAID") {
      throw new OrderError("Verify the bank transfer before confirming or fulfilling this order.");
    }
    if (to === "REFUNDED" && toPaise(order.amountPaid) > 0 && order.paymentStatus !== "REFUNDED") {
      throw new OrderError("Record the refund (with its bank reference) before marking the order refunded.");
    }

    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === "CANCELLED") {
      data.cancelledAt = new Date();
      if (PRE_SHIPMENT.includes(order.status)) await releaseStock(tx, orderId, opts.actorId, "CANCELLATION");
      if (toPaise(order.amountPaid) > 0) data.paymentStatus = "REFUND_PENDING";
      // Free the coupon slot for orders that never went anywhere.
      const usage = await tx.couponUsage.findUnique({ where: { orderId } });
      if (usage) {
        await tx.couponUsage.delete({ where: { id: usage.id } });
        await tx.coupon.update({ where: { id: usage.couponId }, data: { usedCount: { decrement: 1 } } });
      }
    }
    if (to === "SHIPPED") {
      await allocateBatches(tx, orderId);
      const s = await tx.shipment.upsert({ where: { orderId }, create: { orderId, shippedAt: new Date() }, update: { shippedAt: new Date() } });
      await tx.shipmentEvent.create({ data: { shipmentId: s.id, status: "SHIPPED", note: opts.note ?? null, createdById: opts.actorId } });
    }
    if (to === "OUT_FOR_DELIVERY" || to === "DELIVERY_FAILED" || to === "RTO") {
      const s = await tx.shipment.upsert({ where: { orderId }, create: { orderId }, update: {} });
      await tx.shipmentEvent.create({ data: { shipmentId: s.id, status: to, note: opts.note ?? null, createdById: opts.actorId } });
    }
    if (to === "DELIVERED") {
      data.deliveredAt = new Date();
      const s = await tx.shipment.upsert({ where: { orderId }, create: { orderId, deliveredAt: new Date() }, update: { deliveredAt: new Date() } });
      await tx.shipmentEvent.create({ data: { shipmentId: s.id, status: "DELIVERED", note: opts.note ?? null, createdById: opts.actorId } });
    }
    if (to === "CONFIRMED" && !order.invoiceNumber) Object.assign(data, await nextInvoice(tx));
    if (to === "RETURNED" && order.status === "RTO") {
      // Goods are back from the courier: inspection (in Returns) decides what goes back into stock.
      const { openRtoReturn } = await import("@/server/returns");
      await openRtoReturn(tx, orderId, opts.actorId);
    }

    await tx.order.update({ where: { id: orderId }, data });
    await tx.orderStatusHistory.create({ data: { orderId, status: to, note: opts.note ?? null, byUserId: opts.actorId } });
    if (opts.actorId && !opts.system) {
      await audit({ tx, actorId: opts.actorId, action: "order.status", entity: "Order", entityId: orderId, summary: `${order.number}: ${order.status} → ${to}${opts.note ? ` (${opts.note})` : ""}` });
    }
    return order;
  };
  const before = opts.tx ? await run(opts.tx) : await db.$transaction(run);
  if (!opts.tx && CUSTOMER_EMAIL_STATUSES.includes(to)) await sendStatusEmail(orderId, to);
  return before;
}

/** Sequential, gap-free per database invoice numbers (Postgres sequence created in migration). */
async function nextInvoice(tx: Tx) {
  const { business } = await getSettings();
  const rows = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('invoice_number_seq') AS n`;
  const n = Number(rows[0].n);
  const fy = financialYear(new Date());
  return { invoiceNumber: `${business.invoicePrefix || "INV"}/${fy}/${String(n).padStart(5, "0")}`, invoicedAt: new Date() };
}

function financialYear(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

// ─────────────────────────── Customer cancellation ───────────────────────────

export async function customerCancel(orderId: string, actorId: string | null, reason: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (CUSTOMER_CAN_CANCEL.includes(order.status) || (order.paymentMethod === "COD" && ["CONFIRMED", "PROCESSING"].includes(order.status))) {
    await transitionOrder(orderId, "CANCELLED", { actorId, note: `Cancelled by customer: ${reason}`, system: true });
    return "cancelled" as const;
  }
  if (["CONFIRMED", "PROCESSING"].includes(order.status)) {
    await transitionOrder(orderId, "CANCEL_REQUESTED", { actorId, note: `Customer requested cancellation: ${reason}`, system: true });
    const admin = adminEmail();
    if (admin) await notify({ to: admin, template: "admin.cancel-request", subject: `Cancellation requested – ${order.number}`, body: `Order ${order.number} – reason: ${reason}\n${appUrl()}/admin/orders/${order.id}`, orderId });
    return "requested" as const;
  }
  throw new OrderError("This order can no longer be cancelled.");
}

// ─────────────────────────── Bank transfers ───────────────────────────

export async function submitBankTransfer(
  orderId: string,
  input: { reference: string; amountPaise: number; paidOn: Date | null; payerName: string | null; proofKey: string | null },
) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentMethod !== "BANK_TRANSFER") throw new OrderError("This order is not paid by bank transfer.");
  if (!["AWAITING_PAYMENT", "PAYMENT_VERIFICATION"].includes(order.status)) throw new OrderError("This order is not awaiting payment.");
  const pending = await db.bankTransferSubmission.count({ where: { orderId } });
  if (pending >= 5) throw new OrderError("Too many payment submissions for this order – please contact us.");
  const dup = await db.bankTransferSubmission.findFirst({ where: { orderId, reference: input.reference, status: { not: "REJECTED" } } });
  if (dup) throw new OrderError("You have already submitted this transaction reference.");

  await db.$transaction(async (tx) => {
    await tx.bankTransferSubmission.create({ data: { orderId, ...input } });
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "AWAITING_VERIFICATION" } });
    if (order.status === "AWAITING_PAYMENT") {
      await transitionOrder(orderId, "PAYMENT_VERIFICATION", { actorId: order.userId, note: `Customer submitted transfer ref ${input.reference}`, system: true, tx });
    }
  });
  const admin = adminEmail();
  if (admin)
    await notify({
      to: admin,
      template: "admin.payment-submitted",
      subject: `Bank transfer to verify – ${order.number}`,
      body: `Reference: ${input.reference}\nAmount claimed: ${formatINR(input.amountPaise)}\nOrder total: ${formatINR(toPaise(order.total))}\n\nVerify against the bank statement: ${appUrl()}/admin/payments`,
      orderId,
    });
  await notify({
    to: order.email,
    template: "customer.payment-submitted",
    subject: `We received your payment details – ${order.number}`,
    body: `Hello ${order.customerName},\n\nThanks! We'll check transfer reference ${input.reference} against our bank statement and confirm your order once it's verified.\n\n— Driponza`,
    orderId,
    dedupeKey: `payment-submitted:${orderId}:${input.reference}`,
  });
}

/** Only an authorised admin, comparing with the actual bank statement, can mark money as received. */
export async function reviewBankTransfer(
  submissionId: string,
  decision: { approve: boolean; verifiedAmountPaise?: number; bankReference?: string | null; note?: string | null },
  actorId: string,
) {
  const result = await db.$transaction(async (tx) => {
    const sub = await tx.bankTransferSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { order: true } });
    // Guard against two admins acting at once.
    const claimed = await tx.bankTransferSubmission.updateMany({
      where: { id: submissionId, status: "SUBMITTED" },
      data: {
        status: decision.approve ? "VERIFIED" : "REJECTED",
        verifiedAmountPaise: decision.approve ? decision.verifiedAmountPaise : null,
        bankReference: decision.bankReference ?? null,
        reviewNote: decision.note ?? null,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new OrderError("This submission has already been reviewed.");
    const order = sub.order;

    if (!decision.approve) {
      const stillPending = await tx.bankTransferSubmission.count({ where: { orderId: order.id, status: "SUBMITTED" } });
      if (!stillPending && order.paymentStatus === "AWAITING_VERIFICATION") {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: toPaise(order.amountPaid) > 0 ? "PARTIALLY_PAID" : "REJECTED" } });
        if (order.status === "PAYMENT_VERIFICATION")
          await transitionOrder(order.id, "AWAITING_PAYMENT", { actorId, note: `Transfer ${sub.reference} rejected${decision.note ? `: ${decision.note}` : ""}`, system: true, tx });
      }
      await audit({ tx, actorId, action: "payment.reject", entity: "Order", entityId: order.id, summary: `${order.number}: rejected transfer ${sub.reference}` });
      return { order, approved: false, paid: false };
    }

    const amount = decision.verifiedAmountPaise ?? 0;
    if (amount <= 0) throw new OrderError("Enter the amount you verified on the bank statement.");
    await tx.paymentTransaction.create({
      data: { orderId: order.id, kind: "PAYMENT", method: "BANK_TRANSFER", amountPaise: amount, reference: decision.bankReference || sub.reference, note: decision.note ?? null, recordedById: actorId },
    });
    const paid = toPaise(order.amountPaid) + amount;
    const total = toPaise(order.total);
    let paymentStatus = paymentStatusAfterReceipt(total, paid);
    if (order.status === "CANCELLED") paymentStatus = "REFUND_PENDING";
    await tx.order.update({
      where: { id: order.id },
      data: { amountPaid: paiseToDecimalString(paid), paymentStatus, ...(paymentStatus === "PAID" ? { paidAt: new Date() } : {}) },
    });
    if (paymentStatus === "PAID" && ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "ON_HOLD"].includes(order.status)) {
      await transitionOrder(order.id, "CONFIRMED", { actorId, note: `Bank transfer verified (${formatINR(amount)})`, system: true, tx });
    } else if (paymentStatus === "PARTIALLY_PAID" && order.status === "PAYMENT_VERIFICATION") {
      await transitionOrder(order.id, "AWAITING_PAYMENT", { actorId, note: `Partial payment ${formatINR(amount)} of ${formatINR(total)} verified`, system: true, tx });
    }
    await audit({ tx, actorId, action: "payment.verify", entity: "Order", entityId: order.id, summary: `${order.number}: verified ${formatINR(amount)} (ref ${decision.bankReference || sub.reference})` });
    return { order, approved: true, paid: paymentStatus === "PAID" };
  });

  const o = result.order;
  if (!result.approved) {
    await notify({
      to: o.email,
      template: "customer.payment-rejected",
      subject: `We couldn't verify your payment – ${o.number}`,
      body: `Hello ${o.customerName},\n\nWe could not match your transfer to our bank statement${decision.note ? ` (${decision.note})` : ""}. Please check the details and submit again, or reply to this email.\n\n${appUrl()}/account/orders/${o.number}\n\n— Driponza`,
      orderId: o.id,
    });
  } else if (result.paid) {
    await sendStatusEmail(o.id, "CONFIRMED");
  }
}

// ─────────────────────────── COD & refunds ───────────────────────────

export async function recordCodCollection(orderId: string, amountPaise: number, reference: string | null, actorId: string) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.paymentMethod !== "COD") throw new OrderError("This is not a cash-on-delivery order.");
    if (!["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) throw new OrderError("Record COD collection once the order is out for delivery or delivered.");
    const paid = toPaise(order.amountPaid) + amountPaise;
    if (amountPaise <= 0 || paid > toPaise(order.total)) throw new OrderError("Amount must be positive and not exceed the order total.");
    await tx.paymentTransaction.create({ data: { orderId, kind: "COD_COLLECTION", method: "COD", amountPaise, reference, recordedById: actorId } });
    const paymentStatus = paymentStatusAfterReceipt(toPaise(order.total), paid);
    await tx.order.update({ where: { id: orderId }, data: { amountPaid: paiseToDecimalString(paid), paymentStatus, ...(paymentStatus === "PAID" ? { paidAt: new Date() } : {}) } });
    await audit({ tx, actorId, action: "payment.cod", entity: "Order", entityId: orderId, summary: `${order.number}: COD collected ${formatINR(amountPaise)}` });
  });
}

/**
 * Creates a refund record. It is PROCESSED only when staff enter the bank/UPI reference of money actually sent;
 * otherwise it stays PENDING. We never claim money reached the customer without that reference.
 */
export async function createRefund(args: {
  orderId: string;
  amountPaise: number;
  method: string;
  reference: string | null;
  reason: string | null;
  returnRequestId?: string | null;
  actorId: string;
}) {
  const refund = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId }, include: { refunds: true } });
    const paid = toPaise(order.amountPaid);
    const committed = order.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountPaise, 0);
    if (args.amountPaise <= 0) throw new OrderError("Enter a refund amount.");
    if (committed + args.amountPaise > paid) throw new OrderError(`Refunds can't exceed the ${formatINR(paid)} received (already refunded/pending: ${formatINR(committed)}).`);
    const processed = Boolean(args.reference);
    const r = await tx.refund.create({
      data: {
        orderId: order.id,
        returnRequestId: args.returnRequestId ?? null,
        amountPaise: args.amountPaise,
        method: args.method,
        reference: args.reference,
        reason: args.reason,
        status: processed ? "PROCESSED" : "PENDING",
        processedAt: processed ? new Date() : null,
        createdById: args.actorId,
      },
    });
    await applyRefundState(tx, order.id);
    await audit({ tx, actorId: args.actorId, action: "refund.create", entity: "Order", entityId: order.id, summary: `${order.number}: refund ${formatINR(args.amountPaise)} ${processed ? `sent (ref ${args.reference})` : "pending"}` });
    return r;
  });
  if (refund.status === "PROCESSED") await sendRefundEmail(refund.id);
  return refund;
}

export async function completeRefund(refundId: string, reference: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "PENDING" }, data: { status: "PROCESSED", reference, processedAt: new Date() } });
    if (claimed.count === 0) throw new OrderError("This refund is not pending.");
    const r = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    if (r.orderId) await applyRefundState(tx, r.orderId);
    await audit({ tx, actorId, action: "refund.complete", entity: "Refund", entityId: refundId, summary: `Refund ${formatINR(r.amountPaise)} sent, ref ${reference}` });
  });
  await sendRefundEmail(refundId);
}

async function applyRefundState(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
  const paid = toPaise(order.amountPaid);
  const sent = order.refunds.filter((r) => r.status === "PROCESSED").reduce((n, r) => n + r.amountPaise, 0);
  const pending = order.refunds.some((r) => r.status === "PENDING");
  // Ledger: exactly one REFUND transaction per processed refund (idempotent via the note marker).
  for (const r of order.refunds.filter((x) => x.status === "PROCESSED")) {
    const exists = await tx.paymentTransaction.findFirst({ where: { orderId, kind: "REFUND", note: `refund:${r.id}` } });
    if (!exists)
      await tx.paymentTransaction.create({ data: { orderId, kind: "REFUND", method: order.paymentMethod as PaymentMethod, amountPaise: r.amountPaise, reference: r.reference, note: `refund:${r.id}`, recordedById: r.createdById } });
  }
  // A return whose refund has actually been sent is complete.
  const returnIds = order.refunds.filter((r) => r.status === "PROCESSED" && r.returnRequestId).map((r) => r.returnRequestId!);
  if (returnIds.length) await tx.returnRequest.updateMany({ where: { id: { in: returnIds }, status: "INSPECTED" }, data: { status: "REFUNDED" } });
  const paymentStatus = pending ? "REFUND_PENDING" : paymentStatusAfterRefund(paid, sent);
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
  if (paymentStatus === "REFUNDED" && ["CANCELLED", "RETURNED", "REFUND_PENDING", "RTO"].includes(order.status)) {
    await transitionOrder(orderId, "REFUNDED", { actorId: null, note: "Refund completed", system: true, tx });
  }
}

// ─────────────────────────── Expiry (cron) ───────────────────────────

let lastExpiryRun = 0;
/**
 * Opportunistic expiry (the Vercel Hobby cron only runs daily): at most once every 10 minutes per instance,
 * triggered from checkout and the admin panel. Never throws.
 */
export async function maybeExpireUnpaidOrders() {
  if (Date.now() - lastExpiryRun < 10 * 60_000) return;
  lastExpiryRun = Date.now();
  try {
    await expireUnpaidOrders();
  } catch (err) {
    console.error("[expire:opportunistic]", err);
  }
}

/** Cancels unpaid bank-transfer orders past their hold time and releases their stock. */
export async function expireUnpaidOrders() {
  const due = await db.order.findMany({
    where: { paymentMethod: "BANK_TRANSFER", status: "AWAITING_PAYMENT", paymentStatus: { in: ["UNPAID", "REJECTED"] }, paymentDueAt: { lt: new Date() } },
    select: { id: true, number: true },
    take: 100,
  });
  let n = 0;
  for (const o of due) {
    try {
      await db.$transaction(async (tx) => {
        await releaseStock(tx, o.id, null, "RESERVATION_RELEASE");
        await transitionOrder(o.id, "CANCELLED", { actorId: null, note: "Payment not received in time – order cancelled automatically", system: true, tx });
      });
      await sendStatusEmail(o.id, "CANCELLED");
      n++;
    } catch (err) {
      console.error("[expire]", o.number, err);
    }
  }
  return n;
}

// ─────────────────────────── Emails ───────────────────────────

export function orderLink(number: string, guestToken?: string | null) {
  return guestToken ? `${appUrl()}/order/${number}?k=${guestToken}` : `${appUrl()}/account/orders/${number}`;
}

async function sendOrderPlaced(orderId: string, guestToken: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const lines = order.items.map((i) => `• ${i.productName} (${i.variantLabel}) × ${i.quantity} — ${formatINR(toPaise(i.lineTotal))}`).join("\n");
  const bank =
    order.paymentMethod === "BANK_TRANSFER"
      ? `\nPlease pay ${formatINR(toPaise(order.total))} by bank transfer using ${order.number} as the reference. Bank details and the form to submit your transaction reference are on your order page. Unpaid orders are cancelled after ${order.paymentDueAt ? order.paymentDueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "the hold period"}.\n`
      : "\nPayment: cash on delivery.\n";
  await notify({
    to: order.email,
    template: "customer.order-placed",
    subject: `Order ${order.number} received – Driponza`,
    body: `Hello ${order.customerName},\n\nThank you for your order!\n\n${lines}\n\nTotal: ${formatINR(toPaise(order.total))}\n${bank}\nView your order: ${orderLink(order.number, guestToken)}\n\n— Driponza`,
    orderId,
    dedupeKey: `order-placed:${orderId}`,
  });
  const admin = adminEmail();
  if (admin)
    await notify({
      to: admin,
      template: "admin.new-order",
      subject: `New order ${order.number} – ${formatINR(toPaise(order.total))} (${order.paymentMethod === "COD" ? "COD" : "bank transfer"})`,
      body: `${lines}\n\n${appUrl()}/admin/orders/${order.id}`,
      orderId,
      dedupeKey: `admin-new-order:${orderId}`,
    });
}

export async function sendStatusEmail(orderId: string, status: OrderStatus) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) return;
  const s = order.shipment;
  const tracking = s?.trackingNumber ? `\nCourier: ${s.carrier ?? "-"}\nTracking / AWB: ${s.trackingNumber}${s.trackingUrl ? `\nTrack: ${s.trackingUrl}` : ""}\n` : "";
  const label = ORDER_STATUS_LABEL[status].toLowerCase();
  await notify({
    to: order.email,
    template: `customer.status.${status}`,
    subject: `Order ${order.number}: ${ORDER_STATUS_LABEL[status]}`,
    body: `Hello ${order.customerName},\n\nYour Driponza order ${order.number} is now ${label}.\n${tracking}\nView your order: ${orderLink(order.number)}\n\n— Driponza`,
    orderId,
    dedupeKey: `status:${orderId}:${status}:${s?.trackingNumber ?? ""}`,
  });
}

async function sendRefundEmail(refundId: string) {
  const r = await db.refund.findUnique({ where: { id: refundId }, include: { order: true } });
  if (!r?.order || r.status !== "PROCESSED") return;
  await notify({
    to: r.order.email,
    template: "customer.refund-sent",
    subject: `Refund sent for order ${r.order.number}`,
    body: `Hello ${r.order.customerName},\n\nWe have sent a refund of ${formatINR(r.amountPaise)} via ${r.method ?? "bank transfer"} (reference ${r.reference}). Banks usually take 1–5 working days to show it in your account.\n\n— Driponza`,
    orderId: r.orderId,
    dedupeKey: `refund-sent:${refundId}`,
  });
}
