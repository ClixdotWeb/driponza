import { describe, expect, it } from "vitest";
import { computeTotals, evaluateCoupon, includedTax, matchZone, shippingCharge, type CouponRule, type PricingLine, type ZoneRule } from "@/lib/pricing";

const lines: PricingLine[] = [
  { productId: "p1", categoryId: "c1", lineTotalPaise: 60_000, taxRatePercent: 5 },
  { productId: "p2", categoryId: "c2", lineTotalPaise: 40_000, taxRatePercent: null },
];
const now = new Date("2026-11-12T10:00:00Z");
const ctx = { now, customerUses: 0, customerOrders: 0 };
const coupon = (o: Partial<CouponRule> = {}): CouponRule => ({
  id: "k", code: "SAVE10", type: "PERCENT", value: 10, minSubtotalPaise: 0, maxDiscountPaise: null, startsAt: null, endsAt: null,
  usageLimit: null, usedCount: 0, perUserLimit: null, firstOrderOnly: false, productIds: [], categoryIds: [], isActive: true, ...o,
});
const zone = (o: Partial<ZoneRule> = {}): ZoneRule => ({ id: "z", name: "Z", pincodePrefixes: [], states: [], ratePaise: 5_000, freeAbovePaise: null, codAllowed: true, codChargePaise: 3_000, minDays: 2, maxDays: 5, ...o });

describe("evaluateCoupon", () => {
  it("applies a percentage to the whole cart", () => expect(evaluateCoupon(coupon(), lines, ctx)).toEqual({ ok: true, discountPaise: 10_000, freeShipping: false }));
  it("caps by max discount", () => expect(evaluateCoupon(coupon({ maxDiscountPaise: 2_500 }), lines, ctx)).toMatchObject({ discountPaise: 2_500 }));
  it("fixed amount never exceeds the subtotal", () => expect(evaluateCoupon(coupon({ type: "FIXED", value: 5000 }), lines, ctx)).toMatchObject({ discountPaise: 100_000 }));
  it("rejects inactive / expired / not-started / unknown", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ endsAt: new Date("2026-11-01") }), lines, ctx)).toEqual({ ok: false, error: "This coupon has expired." });
    expect(evaluateCoupon(coupon({ startsAt: new Date("2026-12-01") }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(null, lines, ctx).ok).toBe(false);
  });
  it("enforces total, per-customer and first-order limits", () => {
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ perUserLimit: 1 }), lines, { ...ctx, customerUses: 1 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ firstOrderOnly: true }), lines, { ...ctx, customerOrders: 2 }).ok).toBe(false);
  });
  it("enforces minimum subtotal", () => expect(evaluateCoupon(coupon({ minSubtotalPaise: 200_000 }), lines, ctx).ok).toBe(false));
  it("discounts only scoped products/categories", () => {
    expect(evaluateCoupon(coupon({ productIds: ["p2"] }), lines, ctx)).toMatchObject({ discountPaise: 4_000 });
    expect(evaluateCoupon(coupon({ categoryIds: ["c9"] }), lines, ctx).ok).toBe(false);
  });
  it("free-shipping coupons give no money discount", () => expect(evaluateCoupon(coupon({ type: "FREE_SHIPPING", value: 0 }), lines, ctx)).toEqual({ ok: true, discountPaise: 0, freeShipping: true }));
});

describe("shipping zones", () => {
  const zones = [zone({ id: "kzd", pincodePrefixes: ["673"] }), zone({ id: "kzd-city", pincodePrefixes: ["6730"] }), zone({ id: "kerala", states: ["Kerala"] }), zone({ id: "rest" })];
  it("longest PIN prefix wins", () => expect(matchZone(zones, "673001", "Kerala")?.id).toBe("kzd-city"));
  it("falls back to state, then catch-all", () => {
    expect(matchZone(zones, "682001", "Kerala")?.id).toBe("kerala");
    expect(matchZone(zones, "110001", "Delhi")?.id).toBe("rest");
  });
  it("returns null when nothing matches (not serviceable)", () => expect(matchZone([zone({ pincodePrefixes: ["673"] })], "110001", "Delhi")).toBeNull());
  it("free above threshold and with a free-shipping coupon", () => {
    expect(shippingCharge(zone({ freeAbovePaise: 50_000 }), 50_000, false)).toBe(0);
    expect(shippingCharge(zone({ freeAbovePaise: 50_000 }), 49_999, false)).toBe(5_000);
    expect(shippingCharge(zone(), 10_000, true)).toBe(0);
  });
});

describe("totals & tax", () => {
  it("adds shipping and COD charge, subtracts discount", () => {
    const t = computeTotals({ lines, coupon: { ok: true, discountPaise: 10_000, freeShipping: false }, zone: zone(), method: "COD" });
    expect(t).toMatchObject({ subtotalPaise: 100_000, discountPaise: 10_000, shippingPaise: 5_000, codChargePaise: 3_000, totalPaise: 98_000 });
  });
  it("no COD charge for bank transfer", () => expect(computeTotals({ lines, coupon: null, zone: zone(), method: "BANK_TRANSFER" }).codChargePaise).toBe(0));
  it("extracts GST from inclusive prices, pro-rating the discount", () => {
    expect(includedTax(lines, 0)).toBe(Math.round((60_000 * 5) / 105));
    expect(includedTax(lines, 10_000)).toBe(Math.round((54_000 * 5) / 105));
  });
});
