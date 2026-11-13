import { describe, expect, it } from "vitest";
import { addressSchema, INDIAN_STATES } from "@/server/validation";
import { bankTransferReady } from "@/lib/settings";
import { CUSTOMER_CAN_CANCEL, PRE_SHIPMENT, canTransition } from "@/lib/order-status";

const address = (over: Record<string, unknown> = {}) => ({
  fullName: "Safeer K",
  phone: "9946717137",
  line1: "Kedar Tower, Puthiyapalam",
  city: "Kozhikode",
  state: "Kerala",
  pincode: "673002",
  ...over,
});

describe("delivery address", () => {
  it("accepts a normal Indian address", () => expect(addressSchema.safeParse(address()).success).toBe(true));

  it("accepts a mobile with or without +91", () => {
    for (const phone of ["9946717137", "+919946717137", "+91 9946717137", "+91-9946717137"]) {
      expect(addressSchema.safeParse(address({ phone })).success, phone).toBe(true);
    }
  });

  it("rejects landlines and short or malformed numbers", () => {
    for (const phone of ["4952345678", "123456789", "99467171370", "abcdefghij", ""]) {
      expect(addressSchema.safeParse(address({ phone })).success, phone).toBe(false);
    }
  });

  it("rejects PIN codes that cannot exist", () => {
    for (const pincode of ["073002", "67300", "6730021", "ABC123", ""]) {
      expect(addressSchema.safeParse(address({ pincode })).success, pincode).toBe(false);
    }
  });

  it("only allows real states, so a zone can always be matched", () => {
    expect(addressSchema.safeParse(address({ state: "Keralaa" })).success).toBe(false);
    expect(INDIAN_STATES).toContain("Kerala");
    expect(new Set(INDIAN_STATES).size).toBe(INDIAN_STATES.length);
  });

  it("trims and normalises optional fields to null rather than empty strings", () => {
    const parsed = addressSchema.parse(address({ line2: "   ", landmark: undefined }));
    expect(parsed.line2).toBeNull();
    expect(parsed.landmark).toBeNull();
  });
});

describe("bank transfer availability", () => {
  const settings = (bank: Record<string, string>, enabled = true) =>
    ({ commerce: { bankTransferEnabled: enabled }, bank: { accountName: "", accountNumber: "", ifsc: "", ...bank } }) as never;

  it("is offered only when every bank detail is filled in", () => {
    expect(bankTransferReady(settings({ accountName: "Driponza", accountNumber: "123456789", ifsc: "SBIN0000001" }))).toBe(true);
  });

  it("is withheld when any detail is missing – a customer must never see an incomplete account", () => {
    expect(bankTransferReady(settings({ accountName: "Driponza", accountNumber: "123456789" }))).toBe(false);
    expect(bankTransferReady(settings({ accountName: "Driponza", ifsc: "SBIN0000001" }))).toBe(false);
    expect(bankTransferReady(settings({ accountNumber: "123456789", ifsc: "SBIN0000001" }))).toBe(false);
    expect(bankTransferReady(settings({}))).toBe(false);
  });

  it("is withheld when switched off, however complete the details are", () => {
    expect(bankTransferReady(settings({ accountName: "Driponza", accountNumber: "1", ifsc: "SBIN0000001" }, false))).toBe(false);
  });
});

describe("customer cancellation", () => {
  it("is allowed only before the parcel leaves", () => {
    for (const status of CUSTOMER_CAN_CANCEL) expect(PRE_SHIPMENT).toContain(status);
    expect(CUSTOMER_CAN_CANCEL).not.toContain("SHIPPED");
    expect(CUSTOMER_CAN_CANCEL).not.toContain("DELIVERED");
  });

  it("every cancellable status can actually reach CANCELLED", () => {
    for (const status of CUSTOMER_CAN_CANCEL) {
      expect(canTransition(status, "CANCELLED") || canTransition(status, "CANCEL_REQUESTED"), status).toBe(true);
    }
  });
});
