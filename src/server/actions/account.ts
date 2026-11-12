"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { addressSchema } from "@/server/validation";
import type { FormState } from "@/server/actions/auth";

// ─────────── Wishlist ───────────

export async function toggleWishlistAction(productId: string): Promise<{ ok: boolean; inWishlist?: boolean; needsLogin?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsLogin: true };
  const id = z.string().cuid().safeParse(productId);
  if (!id.success) return { ok: false };
  const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: id.data } } });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/wishlist");
    return { ok: true, inWishlist: false };
  }
  const product = await db.product.findFirst({ where: { id: id.data, isActive: true }, select: { id: true } });
  if (!product) return { ok: false };
  await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
  revalidatePath("/wishlist");
  return { ok: true, inWishlist: true };
}

// ─────────── Profile ───────────

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
    .or(z.literal("")),
});

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/account");
  return { success: "Profile updated." };
}

// ─────────── Addresses ───────────

export async function saveAddressAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const limited = await rateLimit("address", 30, 10 * 60_000);
  if (!limited.ok) return { error: "Too many requests." };
  const parsed = addressSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const id = form.get("id");
  const makeDefault = form.get("isDefault") === "on";
  const count = await db.address.count({ where: { userId: user.id } });

  await db.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    if (typeof id === "string" && id) {
      const owned = await tx.address.findFirst({ where: { id, userId: user.id } });
      if (!owned) throw new Error("Address not found");
      await tx.address.update({ where: { id }, data: { ...parsed.data, ...(makeDefault ? { isDefault: true } : {}) } });
    } else {
      await tx.address.create({ data: { ...parsed.data, userId: user.id, isDefault: makeDefault || count === 0 } });
    }
  });
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { success: "Address saved." };
}

export async function deleteAddressAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const owned = await db.address.findFirst({ where: { id, userId: user.id } });
  if (!owned) return;
  await db.$transaction([
    db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/addresses");
}

// ─────────── Newsletter ───────────

export async function subscribeNewsletterAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("newsletter", 5, 10 * 60_000);
  if (!limited.ok) return { error: "Too many requests." };
  const email = z.string().trim().toLowerCase().email().max(160).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  await db.newsletterSubscriber.upsert({ where: { email: email.data }, create: { email: email.data }, update: {} });
  return { success: "Thank you for subscribing!" };
}
