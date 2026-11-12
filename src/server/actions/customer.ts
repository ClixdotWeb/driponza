"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { adminEmail, notify } from "@/server/notify";
import type { FormState } from "@/server/actions/auth";

const ticketSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  phone: z.string().trim().max(20).optional(),
  orderNumber: z.string().trim().toUpperCase().max(40).optional(),
  subject: z.string().trim().min(3, "Enter a subject").max(120),
  message: z.string().trim().min(10, "Tell us a little more").max(4000),
  website: z.string().max(0).optional(), // honeypot – real people leave it empty
});

export async function contactAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("contact", 5, 60 * 60_000);
  if (!limited.ok) return { error: "Too many messages – please try again later or WhatsApp us." };
  const parsed = ticketSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { success: "Thanks – we'll get back to you soon." };
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const user = await getCurrentUser();
  const { website: _hp, ...d } = parsed.data;
  const t = await db.supportTicket.create({ data: { ...d, phone: d.phone || null, orderNumber: d.orderNumber || null, userId: user?.id ?? null } });
  const admin = adminEmail();
  if (admin) await notify({ to: admin, template: "admin.support", subject: `Support: ${d.subject}`, body: `${d.name} <${d.email}>\n\n${d.message}\n\n${process.env.APP_URL ?? ""}/admin/support?id=${t.id}` });
  await notify({ to: d.email, template: "customer.support-received", subject: "We received your message – Driponza", body: `Hello ${d.name},\n\nThanks for writing to us. We usually reply within one working day.\n\n— Driponza`, dedupeKey: `support-received:${t.id}` });
  return { success: "Thanks – we'll get back to you soon." };
}

const reviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().min(10, "Write at least a few words").max(2000),
});

/** One review per customer per product. "Verified" only when they have a delivered order containing it. Goes live after moderation. */
export async function submitReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to write a review." };
  const limited = await rateLimit("review", 10, 60 * 60_000);
  if (!limited.ok) return { error: "Too many reviews – please try later." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  const product = await db.product.findUnique({ where: { id: d.productId }, select: { slug: true } });
  if (!product) return { error: "Product not found." };
  const delivered = await db.order.findFirst({ where: { userId: user.id, status: { in: ["DELIVERED", "RETURN_REQUESTED", "RETURNED"] }, items: { some: { productId: d.productId } } }, select: { id: true } });
  const existing = await db.review.findUnique({ where: { userId_productId: { userId: user.id, productId: d.productId } } });
  const data = { rating: d.rating, title: d.title || null, body: d.body, status: "PENDING" as const, verified: Boolean(delivered), orderId: delivered?.id ?? null };
  if (existing) await db.review.update({ where: { id: existing.id }, data });
  else await db.review.create({ data: { ...data, productId: d.productId, userId: user.id } });
  revalidatePath(`/products/${product.slug}`);
  return { success: existing ? "Thanks – your updated review will appear once approved." : "Thanks – your review will appear once approved." };
}

export async function reportReviewAction(reviewId: string) {
  const limited = await rateLimit("review-report", 20, 60 * 60_000);
  if (!limited.ok) return;
  await db.review.updateMany({ where: { id: String(reviewId).slice(0, 40), status: "APPROVED" }, data: { reports: { increment: 1 } } });
}
