import { describe, expect, it } from "vitest";
import { canTransition, ORDER_TRANSITIONS, paymentStatusAfterReceipt, paymentStatusAfterRefund, REQUIRES_PAYMENT } from "@/lib/order-status";
import { ALL_PERMISSIONS, hasPermission, SYSTEM_ROLES } from "@/lib/permissions";
import { csvCell, parseCsv } from "@/lib/csv";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";

describe("order status machine", () => {
  it("allows the normal fulfilment path", () => {
    const path = [["AWAITING_PAYMENT", "PAYMENT_VERIFICATION"], ["PAYMENT_VERIFICATION", "CONFIRMED"], ["CONFIRMED", "PACKED"], ["PACKED", "SHIPPED"], ["SHIPPED", "OUT_FOR_DELIVERY"], ["OUT_FOR_DELIVERY", "DELIVERED"]] as const;
    for (const [a, b] of path) expect(canTransition(a, b)).toBe(true);
  });
  it("rejects contradictory moves", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(canTransition("REFUNDED", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "SHIPPED")).toBe(false);
    expect(canTransition("CONFIRMED", "CONFIRMED")).toBe(false);
  });
  it("every target is a real status", () => {
    const all = Object.keys(ORDER_TRANSITIONS);
    for (const targets of Object.values(ORDER_TRANSITIONS)) for (const t of targets) expect(all).toContain(t);
  });
  it("fulfilment statuses require payment", () => expect(REQUIRES_PAYMENT).toContain("SHIPPED"));
  it("derives payment status from amounts", () => {
    expect(paymentStatusAfterReceipt(1000, 0)).toBe("UNPAID");
    expect(paymentStatusAfterReceipt(1000, 400)).toBe("PARTIALLY_PAID");
    expect(paymentStatusAfterReceipt(1000, 1000)).toBe("PAID");
    expect(paymentStatusAfterRefund(1000, 300)).toBe("PARTIALLY_REFUNDED");
    expect(paymentStatusAfterRefund(1000, 1000)).toBe("REFUNDED");
  });
});

describe("permissions", () => {
  it("super admin wildcard grants everything", () => expect(ALL_PERMISSIONS.every((p) => hasPermission(["*"], p))).toBe(true));
  it("missing permission is denied", () => {
    expect(hasPermission(["orders.view"], "payments.verify")).toBe(false);
    expect(hasPermission(null, "orders.view")).toBe(false);
  });
  it("seeded roles only reference known permissions", () => {
    for (const r of SYSTEM_ROLES) for (const p of r.permissions) expect(p === "*" || (ALL_PERMISSIONS as string[]).includes(p)).toBe(true);
  });
  it("only Super Admin can manage staff by default", () => {
    expect(SYSTEM_ROLES.filter((r) => hasPermission(r.permissions, "staff.manage")).map((r) => r.name)).toEqual(["Super Admin"]);
  });
  it("support staff cannot verify payments or approve refunds", () => {
    const support = SYSTEM_ROLES.find((r) => r.name === "Customer Support")!;
    expect(hasPermission(support.permissions, "payments.verify")).toBe(false);
    expect(hasPermission(support.permissions, "refunds.approve")).toBe(false);
  });
});

describe("csv", () => {
  it("neutralises formula injection and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("parses quoted fields and CRLF", () => expect(parseCsv('sku,stock\r\n"A,1",5\r\nB,6\n')).toEqual([["sku", "stock"], ["A,1", "5"], ["B", "6"]]));
});

describe("money", () => {
  it("converts without floating point drift", () => {
    expect(toPaise("0.1")).toBe(10);
    expect(toPaise("199.99")).toBe(19999);
    expect(paiseToDecimalString(19999)).toBe("199.99");
    expect(formatINR(10000)).toContain("100");
  });
});
