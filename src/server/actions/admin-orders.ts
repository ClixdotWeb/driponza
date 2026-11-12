"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, ForbiddenError } from "@/lib/auth/session";
import { getSettings, saveSetting, type Settings } from "@/lib/settings";
import { toPaise } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { completeRefund, createRefund, OrderError, recordCodCollection, reviewBankTransfer, transitionOrder } from "@/server/orders";
import { audit } from "@/server/audit";
import type { FormState } from "@/server/actions/auth";
import type { OrderStatus } from "@/generated/prisma/enums";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as [OrderStatus, ...OrderStatus[]];
const amount = z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 499 or 499.50");

function refreshOrder(orderId?: string) {
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/account", "layout");
}

/** Converts domain/permission errors into form messages; anything else is logged and hidden. */
async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OrderError || err instanceof ForbiddenError) return { error: err.message };
    console.error("[admin-orders]", err);
    return { error: "Something went wrong – nothing was changed." };
  }
}

export async function updateOrderStatusAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("orders.update");
    const parsed = z.object({ orderId: z.string().cuid(), status: z.enum(STATUSES), note: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: "Choose a valid status." };
    const { orderId, status, note } = parsed.data;
    await transitionOrder(orderId, status, { actorId: staff.id, note: note || null });
    refreshOrder(orderId);
    return { success: `Status changed to ${ORDER_STATUS_LABEL[status]}.` };
  });
}

/** Applies the same validated transition to many orders; reports per-order failures instead of stopping. */
export async function bulkStatusAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("orders.update");
    const parsed = z.object({ ids: z.array(z.string().cuid()).min(1).max(100), status: z.enum(STATUSES) }).safeParse({ ids: form.getAll("ids"), status: form.get("status") });
    if (!parsed.success) return { error: "Select orders and a status." };
    const failed: string[] = [];
    for (const id of parsed.data.ids) {
      try {
        await transitionOrder(id, parsed.data.status, { actorId: staff.id, note: "Bulk update" });
      } catch (err) {
        const o = await db.order.findUnique({ where: { id }, select: { number: true } });
        failed.push(`${o?.number ?? id}: ${err instanceof OrderError ? err.message : "failed"}`);
      }
    }
    refreshOrder();
    const ok = parsed.data.ids.length - failed.length;
    return failed.length ? { error: `${ok} updated, ${failed.length} skipped – ${failed.slice(0, 5).join("; ")}` } : { success: `${ok} order(s) updated.` };
  });
}

export async function saveShipmentAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("orders.update");
    const parsed = z
      .object({
        orderId: z.string().cuid(),
        carrier: z.string().trim().max(60).optional(),
        trackingNumber: z.string().trim().max(80).optional(),
        trackingUrl: z.string().trim().url("Enter a full URL (https://…)").max(500).or(z.literal("")).optional(),
        weightGrams: z.coerce.number().int().min(0).max(100_000).optional().or(z.literal("")),
        pickupAt: z.string().optional(),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
    const { orderId, ...s } = parsed.data;
    const pickup = s.pickupAt ? new Date(s.pickupAt) : null;
    const data = {
      carrier: s.carrier || null,
      trackingNumber: s.trackingNumber || null,
      trackingUrl: s.trackingUrl || null,
      weightGrams: typeof s.weightGrams === "number" ? s.weightGrams : null,
      pickupAt: pickup && !Number.isNaN(pickup.getTime()) ? pickup : null,
    };
    await db.shipment.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
    await audit({ actorId: staff.id, action: "shipment.save", entity: "Order", entityId: orderId, summary: `Shipment: ${data.carrier ?? "-"} ${data.trackingNumber ?? ""}` });
    refreshOrder(orderId);
    return { success: "Shipment details saved." };
  });
}

export async function addShipmentEventAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("orders.update");
    const parsed = z
      .object({ orderId: z.string().cuid(), status: z.string().trim().min(2).max(60), location: z.string().trim().max(80).optional(), note: z.string().trim().max(300).optional() })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: "Enter a tracking update." };
    const { orderId, ...e } = parsed.data;
    const s = await db.shipment.upsert({ where: { orderId }, create: { orderId }, update: {} });
    await db.shipmentEvent.create({ data: { shipmentId: s.id, status: e.status, location: e.location || null, note: e.note || null, createdById: staff.id } });
    refreshOrder(orderId);
    return { success: "Tracking update added." };
  });
}

export async function saveAdminNoteAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    await assertPermission("orders.update");
    const orderId = z.string().cuid().parse(form.get("orderId"));
    await db.order.update({ where: { id: orderId }, data: { adminNote: String(form.get("adminNote") ?? "").slice(0, 2000) || null } });
    refreshOrder(orderId);
    return { success: "Note saved." };
  });
}

// ─────────── Payments ───────────

export async function reviewTransferAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("payments.verify");
    const parsed = z
      .object({
        submissionId: z.string().cuid(),
        decision: z.enum(["approve", "reject"]),
        verifiedAmount: amount.optional().or(z.literal("")),
        bankReference: z.string().trim().max(80).optional(),
        note: z.string().trim().max(300).optional(),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    if (d.decision === "approve" && !d.verifiedAmount) return { error: "Enter the amount you can see on the bank statement." };
    if (d.decision === "reject" && !d.note) return { error: "Tell the customer why the payment could not be matched." };
    await reviewBankTransfer(
      d.submissionId,
      { approve: d.decision === "approve", verifiedAmountPaise: d.verifiedAmount ? toPaise(d.verifiedAmount) : undefined, bankReference: d.bankReference || null, note: d.note || null },
      staff.id,
    );
    refreshOrder();
    return { success: d.decision === "approve" ? "Payment verified." : "Submission rejected – the customer has been told." };
  });
}

export async function recordCodAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("payments.verify");
    const parsed = z.object({ orderId: z.string().cuid(), amount, reference: z.string().trim().max(80).optional() }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    await recordCodCollection(parsed.data.orderId, toPaise(parsed.data.amount), parsed.data.reference || null, staff.id);
    refreshOrder(parsed.data.orderId);
    return { success: "COD collection recorded." };
  });
}

export async function createRefundAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("refunds.approve");
    const parsed = z
      .object({
        orderId: z.string().cuid(),
        amount,
        method: z.enum(["BANK_TRANSFER", "UPI", "CASH", "OTHER"]),
        reference: z.string().trim().max(80).optional(),
        reason: z.string().trim().max(200).optional(),
        returnRequestId: z.string().cuid().optional().or(z.literal("")),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    const r = await createRefund({
      orderId: d.orderId,
      amountPaise: toPaise(d.amount),
      method: d.method,
      reference: d.reference || null,
      reason: d.reason || null,
      returnRequestId: d.returnRequestId || null,
      actorId: staff.id,
    });
    refreshOrder(d.orderId);
    return { success: r.status === "PROCESSED" ? "Refund recorded as sent." : "Refund approved – add the bank reference once the money is sent." };
  });
}

export async function completeRefundAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("refunds.approve");
    const parsed = z.object({ refundId: z.string().cuid(), reference: z.string().trim().min(4, "Enter the bank / UPI reference").max(80), orderId: z.string().cuid() }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    await completeRefund(parsed.data.refundId, parsed.data.reference, staff.id);
    refreshOrder(parsed.data.orderId);
    return { success: "Refund marked as sent." };
  });
}

// ─────────── Customers & staff ───────────

export async function setCustomerActiveAction(userId: string, active: boolean) {
  const staff = await assertPermission("customers.manage");
  if (userId === staff.id) return;
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  if (!target) return;
  if (target.role === "ADMIN") await assertPermission("staff.manage"); // only staff managers may lock staff accounts
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  if (!active) await db.session.deleteMany({ where: { userId } });
  await audit({ actorId: staff.id, action: active ? "customer.activate" : "customer.suspend", entity: "User", entityId: userId, summary: `${active ? "Reactivated" : "Suspended"} ${target.email}` });
  revalidatePath("/admin/customers");
}

/** Grants/changes/removes staff access. roleId "" = make a regular customer. */
export async function setStaffRoleAction(userId: string, roleId: string) {
  const staff = await assertPermission("staff.manage");
  if (userId === staff.id) return { error: "You can't change your own role." };
  const role = roleId ? await db.staffRole.findUnique({ where: { id: roleId } }) : null;
  if (roleId && !role) return { error: "Role not found." };
  // Never leave the store without a Super Admin.
  const target = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, staffRoleId: true } });
  if (target.staffRoleId === "role_super_admin" && roleId !== "role_super_admin") {
    const supers = await db.user.count({ where: { staffRoleId: "role_super_admin", isActive: true } });
    if (supers <= 1) return { error: "At least one active Super Admin is required." };
  }
  await db.user.update({ where: { id: userId }, data: { role: role ? "ADMIN" : "CUSTOMER", staffRoleId: role?.id ?? null } });
  await db.session.deleteMany({ where: { userId } }); // force re-login with the new permissions
  await audit({ actorId: staff.id, action: "staff.role", entity: "User", entityId: userId, summary: `${target.email} → ${role?.name ?? "customer (no staff access)"}` });
  revalidatePath("/admin/customers");
  revalidatePath("/admin/staff");
  return { success: "Access updated." };
}

export async function saveCustomerNoteAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("customers.manage");
    const userId = z.string().cuid().parse(form.get("userId"));
    await db.user.update({ where: { id: userId }, data: { adminNote: String(form.get("adminNote") ?? "").slice(0, 2000) || null } });
    await audit({ actorId: staff.id, action: "customer.note", entity: "User", entityId: userId, summary: "Updated customer note" });
    revalidatePath(`/admin/customers/${userId}`);
    return { success: "Note saved." };
  });
}

// ─────────── Site content & settings ───────────

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function saveSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const section = String(form.get("section"));
    const staff = await assertPermission(["content", "contact", "policies"].includes(section) ? "content.manage" : "settings.manage");
    const current = await getSettings();
    const str = (k: string) => String(form.get(k) ?? "").trim();
    const optMoney = (k: string) => (str(k) ? toPaise(str(k)) : null);
    try {
      if (section === "content") {
        const next: Settings["content"] = {
          announcement: str("announcement"),
          heroEyebrow: str("heroEyebrow"),
          heroLine1: str("heroLine1"),
          heroLine2: str("heroLine2"),
          heroText: str("heroText"),
          statement: str("statement"),
          storyTitle: str("storyTitle"),
          storyText: str("storyText"),
          ctaTitle: str("ctaTitle"),
          ctaText: str("ctaText"),
          annotations: [str("annotation1"), str("annotation2"), str("annotation3")],
        };
        await saveSetting("content", next);
      } else if (section === "contact") {
        await saveSetting("contact", {
          phone: str("phone"),
          whatsapp: str("whatsapp").replace(/\D/g, ""),
          email: str("email"),
          website: str("website"),
          addressLines: lines(form.get("addressLines")),
          mapUrl: str("mapUrl"),
          instagram: str("instagram"),
          facebook: str("facebook"),
          youtube: str("youtube"),
        });
      } else if (section === "commerce") {
        await saveSetting("commerce", {
          shippingFlatPaise: toPaise(str("shippingFlat") || "0"),
          freeShippingAbovePaise: optMoney("freeShippingAbove"),
          codEnabled: form.get("codEnabled") === "on",
          codChargePaise: toPaise(str("codCharge") || "0"),
          codMaxOrderPaise: optMoney("codMaxOrder"),
          bankTransferEnabled: form.get("bankTransferEnabled") === "on",
          bankTransferHoldHours: Number(str("bankTransferHoldHours") || 48),
          minOrderPaise: toPaise(str("minOrder") || "0"),
          maxQtyPerLine: Number(str("maxQtyPerLine") || 20),
          returnWindowDays: str("returnWindowDays") ? Number(str("returnWindowDays")) : null,
          whatsappOrdering: form.get("whatsappOrdering") === "on",
          shippingConfigured: true,
        });
      } else if (section === "bank") {
        await saveSetting("bank", {
          accountName: str("accountName"),
          bankName: str("bankName"),
          accountNumber: str("accountNumber").replace(/\s/g, ""),
          ifsc: str("ifsc").toUpperCase(),
          branch: str("branch"),
          upiId: str("upiId"),
          instructions: str("instructions"),
        });
      } else if (section === "business") {
        await saveSetting("business", {
          legalName: str("legalName"),
          gstin: str("gstin").toUpperCase(),
          invoicePrefix: str("invoicePrefix").toUpperCase(),
          invoiceFooter: str("invoiceFooter"),
          stateOfSupply: str("stateOfSupply"),
        });
      } else if (section === "policies") {
        await saveSetting("policies", { ...current.policies, privacy: str("privacy"), terms: str("terms"), shipping: str("shipping"), returns: str("returns") });
      } else return { error: "Unknown section" };
    } catch (err) {
      if (err instanceof z.ZodError) return { error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
      throw err;
    }
    // Bank details are sensitive business data – log that they changed, never their values.
    await audit({ actorId: staff.id, action: "settings.save", entity: "Setting", entityId: section, summary: `Updated ${section} settings` });
    revalidatePath("/", "layout");
    return { success: "Saved." };
  });
}
