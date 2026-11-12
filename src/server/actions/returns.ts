"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, ForbiddenError, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { uploadMedia } from "@/server/media";
import { OrderError } from "@/server/orders";
import { requestReturn, updateReturn } from "@/server/returns";
import type { FormState } from "@/server/actions/auth";

export async function requestReturnAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const limited = await rateLimit("return", 5, 60 * 60_000);
  if (!limited.ok) return { error: "Too many requests – please try later." };
  const parsed = z
    .object({ orderNumber: z.string().max(40), reason: z.string().trim().min(3, "Choose a reason").max(120), details: z.string().trim().max(1000).optional() })
    .safeParse({ orderNumber: form.get("orderNumber"), reason: form.get("reason"), details: form.get("details") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const order = await db.order.findFirst({ where: { number: parsed.data.orderNumber, userId: user.id }, include: { items: true } });
  if (!order) return { error: "Order not found." };
  const items = order.items.map((i) => ({ orderItemId: i.id, quantity: Math.max(0, Math.min(i.quantity, Number(form.get(`qty_${i.id}`)) || 0)) }));

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  const imageKeys: string[] = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return { error: "Each photo must be under 8 MB." };
    try {
      imageKeys.push((await uploadMedia(Buffer.from(await f.arrayBuffer()), "private/returns", { isPrivate: true, actorId: user.id })).key);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not upload the photo." };
    }
  }
  try {
    await requestReturn({ orderId: order.id, userId: user.id, reason: parsed.data.reason, details: parsed.data.details ?? null, items, imageKeys });
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Could not submit your return request." };
  }
  revalidatePath(`/account/orders/${order.number}`);
  return { success: "Return requested – we'll email you once it's reviewed." };
}

export async function updateReturnAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const staff = await assertPermission("returns.manage");
    const parsed = z
      .object({ returnId: z.string().cuid(), to: z.enum(["APPROVED", "REJECTED", "RECEIVED", "INSPECTED", "REFUNDED", "CLOSED"]), note: z.string().trim().max(500).optional() })
      .safeParse({ returnId: form.get("returnId"), to: form.get("to"), note: form.get("note") || undefined });
    if (!parsed.success) return { error: "Invalid request." };
    if (parsed.data.to === "REJECTED" && !parsed.data.note) return { error: "Add a reason for the customer." };
    const conditions: Record<string, "RESELLABLE" | "DAMAGED"> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("cond_") && (v === "RESELLABLE" || v === "DAMAGED")) conditions[k.slice(5)] = v;
    await updateReturn(parsed.data.returnId, parsed.data.to, { actorId: staff.id, note: parsed.data.note ?? null, conditions });
    revalidatePath(`/admin/returns/${parsed.data.returnId}`);
    revalidatePath("/admin/returns");
    return { success: "Return updated." };
  } catch (err) {
    if (err instanceof OrderError || err instanceof ForbiddenError) return { error: err.message };
    console.error("[returns]", err);
    return { error: "Something went wrong – nothing was changed." };
  }
}
