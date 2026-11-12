// Pure pricing rules (no database access) – used by checkout and unit-tested.
// All amounts are integer paise. Prices are GST-inclusive; tax is reported, never added on top.

export type PricingLine = {
  productId: string;
  categoryId: string;
  lineTotalPaise: number;
  taxRatePercent: number | null;
};

export type CouponRule = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number; // percent (e.g. 10) or rupees (FIXED) – as stored
  minSubtotalPaise: number;
  maxDiscountPaise: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  firstOrderOnly: boolean;
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
};

export type CouponContext = {
  now: Date;
  /** Previous successful uses of this coupon by this customer (by user id or email). */
  customerUses: number;
  /** Customer's earlier non-cancelled orders (for first-order coupons). */
  customerOrders: number;
};

export type ZoneRule = {
  id: string;
  name: string;
  pincodePrefixes: string[];
  states: string[];
  ratePaise: number;
  freeAbovePaise: number | null;
  codAllowed: boolean;
  codChargePaise: number;
  minDays: number;
  maxDays: number;
};

export type CouponResult =
  | { ok: true; discountPaise: number; freeShipping: boolean }
  | { ok: false; error: string };

const rupeesToPaise = (r: number) => Math.round(r * 100);

export function evaluateCoupon(coupon: CouponRule | null, lines: PricingLine[], ctx: CouponContext): CouponResult {
  if (!coupon || !coupon.isActive) return { ok: false, error: "This coupon is not valid." };
  if (coupon.startsAt && coupon.startsAt > ctx.now) return { ok: false, error: "This coupon is not active yet." };
  if (coupon.endsAt && coupon.endsAt < ctx.now) return { ok: false, error: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { ok: false, error: "This coupon has been fully redeemed." };
  if (coupon.perUserLimit !== null && ctx.customerUses >= coupon.perUserLimit) return { ok: false, error: "You have already used this coupon." };
  if (coupon.firstOrderOnly && ctx.customerOrders > 0) return { ok: false, error: "This coupon is only for your first order." };

  const subtotal = lines.reduce((n, l) => n + l.lineTotalPaise, 0);
  if (subtotal < coupon.minSubtotalPaise) return { ok: false, error: `Spend at least ₹${(coupon.minSubtotalPaise / 100).toLocaleString("en-IN")} to use this coupon.` };

  const scoped = coupon.productIds.length || coupon.categoryIds.length;
  const eligible = scoped
    ? lines.filter((l) => coupon.productIds.includes(l.productId) || coupon.categoryIds.includes(l.categoryId))
    : lines;
  const base = eligible.reduce((n, l) => n + l.lineTotalPaise, 0);
  if (scoped && base === 0) return { ok: false, error: "This coupon doesn't apply to the items in your cart." };

  if (coupon.type === "FREE_SHIPPING") return { ok: true, discountPaise: 0, freeShipping: true };
  let discount = coupon.type === "PERCENT" ? Math.floor((base * coupon.value) / 100) : rupeesToPaise(coupon.value);
  if (coupon.maxDiscountPaise !== null) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, base));
  return { ok: true, discountPaise: discount, freeShipping: false };
}

/** Longest matching PIN prefix wins; then a zone listing the state; then a catch-all zone (no prefixes, no states). */
export function matchZone(zones: ZoneRule[], pincode: string, state: string | null): ZoneRule | null {
  let best: { zone: ZoneRule; score: number } | null = null;
  for (const z of zones) {
    let score = -1;
    for (const p of z.pincodePrefixes) if (p && pincode.startsWith(p)) score = Math.max(score, 100 + p.length);
    if (score < 0 && state && z.states.some((s) => s.toLowerCase() === state.toLowerCase())) score = 50;
    if (score < 0 && !z.pincodePrefixes.length && !z.states.length) score = 1;
    if (score >= 0 && (!best || score > best.score)) best = { zone: z, score };
  }
  return best?.zone ?? null;
}

export function shippingCharge(zone: ZoneRule, subtotalAfterDiscountPaise: number, freeShipping: boolean) {
  if (freeShipping || subtotalAfterDiscountPaise <= 0) return 0;
  if (zone.freeAbovePaise !== null && subtotalAfterDiscountPaise >= zone.freeAbovePaise) return 0;
  return zone.ratePaise;
}

/** GST contained in a tax-inclusive amount: amount × r / (100 + r). Discounts are apportioned pro-rata. */
export function includedTax(lines: PricingLine[], discountPaise: number) {
  const subtotal = lines.reduce((n, l) => n + l.lineTotalPaise, 0);
  if (subtotal <= 0) return 0;
  let tax = 0;
  for (const l of lines) {
    if (!l.taxRatePercent) continue;
    const net = l.lineTotalPaise - Math.round((discountPaise * l.lineTotalPaise) / subtotal);
    tax += Math.round((net * l.taxRatePercent) / (100 + l.taxRatePercent));
  }
  return tax;
}

export type Totals = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codChargePaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function computeTotals(args: {
  lines: PricingLine[];
  coupon: CouponResult | null;
  zone: ZoneRule | null;
  method: "BANK_TRANSFER" | "COD" | null;
}): Totals {
  const subtotal = args.lines.reduce((n, l) => n + l.lineTotalPaise, 0);
  const discount = args.coupon?.ok ? args.coupon.discountPaise : 0;
  const free = Boolean(args.coupon?.ok && args.coupon.freeShipping);
  const shipping = args.zone ? shippingCharge(args.zone, subtotal - discount, free) : 0;
  const cod = args.method === "COD" && args.zone ? args.zone.codChargePaise : 0;
  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    shippingPaise: shipping,
    codChargePaise: cod,
    taxPaise: includedTax(args.lines, discount),
    totalPaise: subtotal - discount + shipping + cod,
  };
}
