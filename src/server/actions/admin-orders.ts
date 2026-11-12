"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/session";
import { razorpay, razorpayConfigured } from "@/lib/razorpay";
import { getSettings, saveSetting, type Settings } from "@/lib/settings";
import { toPaise } from "@/lib/money";
import { markOrderPaid, recordRefund, restockOrder, setOrderStatus } from "@/server/orders";
import type { FormState } from "@/server/actions/auth";

const ADMIN_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "ON_HOLD", "CANCELLED"] as const;

function refreshOrder(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/account", "layout");
}

export async function updateOrderStatusAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  const parsed = z
    .object({ orderId: z.string().cuid(), status: z.enum(ADMIN_STATUSES), note: z.string().trim().max(300).optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose a valid status." };
  const { orderId, status, note } = parsed.data;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Order not found." };
  if (["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) && status !== "CANCELLED" && order.paymentMethod === "RAZORPAY") {
    return { error: "This order hasn't been paid. Only cancellation is possible until payment is verified." };
  }
  if (status === "CANCELLED" && order.paymentStatus === "PAID") {
    return { error: "This order is paid – use “Cancel & refund” so the customer gets their money back." };
  }
  await setOrderStatus(orderId, status, note || null, admin.id);
  refreshOrder(orderId);
  return { success: "Status updated." };
}

export async function saveShipmentAction(_: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = z
    .object({
      orderId: z.string().cuid(),
      carrier: z.string().trim().max(60).optional(),
      trackingNumber: z.string().trim().max(80).optional(),
      trackingUrl: z.string().trim().url("Enter a full URL (https://…)").max(500).or(z.literal("")).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { orderId, ...ship } = parsed.data;
  const data = { carrier: ship.carrier || null, trackingNumber: ship.trackingNumber || null, trackingUrl: ship.trackingUrl || null };
  await db.shipment.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
  refreshOrder(orderId);
  return { success: "Tracking details saved." };
}

export async function saveAdminNoteAction(_: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const orderId = String(form.get("orderId"));
  await db.order.update({ where: { id: orderId }, data: { adminNote: String(form.get("adminNote") ?? "").slice(0, 2000) || null } });
  refreshOrder(orderId);
  return { success: "Note saved." };
}

const refundSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount"),
  reason: z.string().trim().max(200).optional(),
  restock: z.preprocess((v) => v === "on", z.boolean()),
  cancel: z.preprocess((v) => v === "on", z.boolean()),
});

/** Issues a real refund through Razorpay; nothing is marked refunded unless Razorpay accepts it. */
export async function refundOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  if (!razorpayConfigured()) return { error: "Refunds need Razorpay credentials." };
  const parsed = refundSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orderId, amount, reason, restock, cancel } = parsed.data;
  const payment = await db.payment.findFirst({ where: { orderId, status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "desc" } });
  if (!payment?.providerPaymentId) return { error: "No captured payment found for this order." };
  const amountPaise = toPaise(amount);
  const refundable = payment.amountPaise - payment.refundedPaise;
  if (amountPaise <= 0 || amountPaise > refundable) return { error: `You can refund up to ₹${(refundable / 100).toFixed(2)}.` };

  try {
    const refund = await razorpay().payments.refund(payment.providerPaymentId, {
      amount: amountPaise,
      speed: "normal",
      notes: { orderId, reason: reason ?? "" },
    });
    await recordRefund({
      paymentId: payment.id,
      providerRefundId: refund.id,
      amountPaise: Number(refund.amount),
      status: refund.status === "processed" ? "PROCESSED" : refund.status === "failed" ? "FAILED" : "PENDING",
      reason: reason || null,
      createdById: admin.id,
    });
  } catch (err) {
    console.error("[razorpay:refund]", err);
    const message = (err as { error?: { description?: string } })?.error?.description;
    return { error: message ? `Razorpay: ${message}` : "Refund failed at Razorpay." };
  }

  if (restock || cancel) {
    await db.$transaction(async (tx) => {
      if (restock) await restockOrder(tx, orderId, admin.id, "CANCELLATION");
      if (cancel) {
        await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        await tx.orderStatusHistory.create({ data: { orderId, status: "CANCELLED", note: "Cancelled and refunded by admin", byUserId: admin.id } });
      }
    });
  }
  refreshOrder(orderId);
  return { success: "Refund submitted to Razorpay." };
}

/** Re-checks a payment against Razorpay's records (admin "verify payment"). */
export async function syncPaymentAction(paymentId: string): Promise<{ ok: boolean; message: string }> {
  await assertAdmin();
  if (!razorpayConfigured()) return { ok: false, message: "Razorpay credentials are not configured." };
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, message: "Payment not found." };
  try {
    const result = await razorpay().orders.fetchPayments(payment.providerOrderId);
    const items = (result.items ?? []) as Array<{ id: string; status: string; amount: number | string; method?: string; error_code?: string; error_description?: string }>;
    const captured = items.find((p) => p.status === "captured");
    if (captured) {
      await markOrderPaid({
        providerOrderId: payment.providerOrderId,
        providerPaymentId: captured.id,
        amountPaise: Number(captured.amount),
        method: captured.method ?? null,
        source: "webhook",
      });
      refreshOrder(payment.orderId);
      return { ok: true, message: "Verified with Razorpay: payment captured." };
    }
    const latest = items[0];
    if (latest?.status === "failed") {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", errorCode: latest.error_code ?? null, errorDescription: latest.error_description ?? null } });
    }
    refreshOrder(payment.orderId);
    return { ok: true, message: latest ? `Razorpay reports: ${latest.status}` : "Razorpay has no payment attempts for this order." };
  } catch (err) {
    console.error("[razorpay:sync]", err);
    return { ok: false, message: "Could not reach Razorpay." };
  }
}

// ─────────── Customers ───────────

export async function setCustomerActiveAction(userId: string, active: boolean) {
  const admin = await assertAdmin();
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  if (!active) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/customers");
}

export async function setUserRoleAction(userId: string, role: "CUSTOMER" | "ADMIN") {
  const admin = await assertAdmin();
  if (userId === admin.id) return; // can't demote yourself
  await db.user.update({ where: { id: userId }, data: { role } });
  await db.session.deleteMany({ where: { userId } }); // force re-login with new permissions
  revalidatePath("/admin/customers");
}

// ─────────── Site content & settings ───────────

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function saveSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const section = String(form.get("section"));
  const current = await getSettings();
  const str = (k: string) => String(form.get(k) ?? "").trim();
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
      const free = str("freeShippingAbove");
      await saveSetting("commerce", {
        shippingFlatPaise: toPaise(str("shippingFlat") || "0"),
        freeShippingAbovePaise: free ? toPaise(free) : null,
        codEnabled: form.get("codEnabled") === "on",
        whatsappOrdering: form.get("whatsappOrdering") === "on",
        shippingConfigured: true,
      });
    } else if (section === "policies") {
      await saveSetting("policies", { ...current.policies, privacy: str("privacy"), terms: str("terms"), shipping: str("shipping"), returns: str("returns") });
    } else return { error: "Unknown section" };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    throw err;
  }
  revalidatePath("/", "layout");
  return { success: "Saved." };
}
