"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { releaseMedia } from "@/server/media";
import { slugify } from "@/lib/utils";
import type { FormState } from "@/server/actions/auth";

function refreshStorefront() {
  revalidatePath("/", "layout");
}

function issues(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 120 or 120.50");

const variantSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Variant label required").max(40),
  weightGrams: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  sku: z.string().trim().min(2, "SKU required").max(40).regex(/^[A-Za-z0-9-_]+$/, "Letters, numbers, - and _ only"),
  price: money,
  mrp: money.or(z.literal("")).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name required").max(120),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().min(10, "Add a description (10+ characters)").max(4000),
  tag: z.string().trim().max(40).optional(),
  categoryId: z.string().cuid("Choose a category"),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  featuredOrder: z.coerce.number().int().min(0).max(999),
  needsReview: z.boolean(),
  reviewNotes: z.string().trim().max(2000).optional(),
  variants: z.array(variantSchema).min(1, "Add at least one weight / variant"),
});

export async function saveProductAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await assertPermission("products.edit");
  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form data" };
  }
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!slug) return { fieldErrors: { slug: "Slug required" } };

  for (const v of d.variants) {
    if (v.mrp && Number(v.mrp) < Number(v.price)) return { error: `MRP for “${v.label}” must be at least the selling price.` };
  }
  const skus = d.variants.map((v) => v.sku.toUpperCase());
  if (new Set(skus).size !== skus.length) return { error: "Each variant needs a unique SKU." };

  const slugTaken = await db.product.findFirst({ where: { slug, NOT: d.id ? { id: d.id } : undefined }, select: { id: true } });
  if (slugTaken) return { fieldErrors: { slug: "Another product already uses this URL slug" } };
  const skuTaken = await db.productVariant.findFirst({
    where: { sku: { in: skus }, NOT: d.id ? { productId: d.id } : undefined },
    select: { sku: true },
  });
  if (skuTaken) return { error: `SKU ${skuTaken.sku} is already used by another product.` };

  const base = {
    name: d.name,
    slug,
    description: d.description,
    tag: d.tag || null,
    categoryId: d.categoryId,
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    featuredOrder: d.featuredOrder,
    needsReview: d.needsReview,
    reviewNotes: d.reviewNotes || null,
  };

  const productId = await db.$transaction(async (tx) => {
    const product = d.id
      ? await tx.product.update({ where: { id: d.id }, data: base })
      : await tx.product.create({ data: base });

    const keepIds = d.variants.map((v) => v.id).filter((x): x is string => Boolean(x));
    // Variants removed in the form: delete if never sold, otherwise deactivate to keep order history intact.
    const removed = await tx.productVariant.findMany({ where: { productId: product.id, id: { notIn: keepIds } }, include: { _count: { select: { orderItems: true } } } });
    for (const r of removed) {
      if (r._count.orderItems > 0) await tx.productVariant.update({ where: { id: r.id }, data: { isActive: false } });
      else await tx.productVariant.delete({ where: { id: r.id } });
    }

    for (const [position, v] of d.variants.entries()) {
      const data = {
        label: v.label,
        weightGrams: v.weightGrams ?? null,
        sku: v.sku.toUpperCase(),
        price: v.price,
        mrp: v.mrp ? v.mrp : null,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
        position,
      };
      if (v.id) {
        const owned = await tx.productVariant.findFirst({ where: { id: v.id, productId: product.id } });
        if (!owned) throw new Error("Variant does not belong to this product");
        await tx.productVariant.update({ where: { id: v.id }, data });
      } else {
        const stock = v.stock ?? 0;
        await tx.productVariant.create({
          data: {
            ...data,
            productId: product.id,
            stock,
            movements: { create: { change: stock, stockAfter: stock, reason: "INITIAL", note: "Variant created", userId: admin.id } },
          },
        });
      }
    }
    return product.id;
  });

  refreshStorefront();
  if (!d.id) redirect(`/admin/products/${productId}?created=1`);
  return { success: "Product saved." };
}

export async function deleteProductAction(productId: string): Promise<{ ok: boolean; message: string }> {
  await assertPermission("products.delete");
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { images: true, variants: { include: { _count: { select: { orderItems: true } } } } },
  });
  if (!product) return { ok: false, message: "Product not found." };
  const sold = product.variants.some((v) => v._count.orderItems > 0);
  if (sold) {
    await db.product.update({ where: { id: productId }, data: { isActive: false, isFeatured: false } });
    refreshStorefront();
    return { ok: true, message: "This product has orders, so it was archived (hidden from the shop) instead of deleted." };
  }
  await db.product.delete({ where: { id: productId } });
  for (const i of product.images) await releaseMedia(i.storageId, i.url);
  refreshStorefront();
  return { ok: true, message: "Product deleted." };
}

export async function toggleFeaturedAction(productId: string, featured: boolean) {
  await assertPermission("products.edit");
  await db.product.update({ where: { id: productId }, data: { isFeatured: featured } });
  refreshStorefront();
  revalidatePath("/admin/content");
}

export async function setFeaturedOrderAction(productId: string, order: number) {
  await assertPermission("products.edit");
  await db.product.update({ where: { id: productId }, data: { featuredOrder: Math.max(0, Math.min(999, Math.round(order))) } });
  refreshStorefront();
  revalidatePath("/admin/content");
}

// ─────────── Images ───────────

export async function deleteImageAction(imageId: string) {
  await assertPermission("media.manage");
  const image = await db.productImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  await db.productImage.delete({ where: { id: imageId } });
  await releaseMedia(image.storageId, image.url);
  refreshStorefront();
  revalidatePath(`/admin/products/${image.productId}`);
}

export async function moveImageAction(imageId: string, direction: -1 | 1) {
  await assertPermission("products.edit");
  const image = await db.productImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  const images = await db.productImage.findMany({ where: { productId: image.productId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const idx = images.findIndex((i) => i.id === imageId);
  const swap = images[idx + direction];
  if (!swap) return;
  [images[idx], images[idx + direction]] = [swap, images[idx]];
  await db.$transaction(images.map((img, position) => db.productImage.update({ where: { id: img.id }, data: { position } })));
  refreshStorefront();
  revalidatePath(`/admin/products/${image.productId}`);
}

export async function updateImageAltAction(imageId: string, alt: string) {
  await assertPermission("products.edit");
  await db.productImage.update({ where: { id: imageId }, data: { alt: alt.trim().slice(0, 160) || null } });
  refreshStorefront();
}

// ─────────── Categories ───────────

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name required").max(60),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(400).optional(),
  position: z.coerce.number().int().min(0).max(999),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveCategoryAction(_: FormState, form: FormData): Promise<FormState> {
  await assertPermission("categories.manage");
  const parsed = categorySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  const clash = await db.category.findFirst({ where: { OR: [{ slug }, { name: d.name }], NOT: d.id ? { id: d.id } : undefined } });
  if (clash) return { error: "A category with this name or slug already exists." };
  const data = { name: d.name, slug, description: d.description || null, position: d.position, isActive: d.isActive };
  if (d.id) await db.category.update({ where: { id: d.id }, data });
  else await db.category.create({ data });
  refreshStorefront();
  revalidatePath("/admin/categories");
  return { success: "Category saved." };
}

export async function deleteCategoryAction(id: string): Promise<{ ok: boolean; message: string }> {
  await assertPermission("categories.manage");
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0) return { ok: false, message: `Move or delete its ${count} product(s) first.` };
  await db.category.delete({ where: { id } });
  refreshStorefront();
  revalidatePath("/admin/categories");
  return { ok: true, message: "Category deleted." };
}

// ─────────── Inventory ───────────

const adjustSchema = z.object({
  variantId: z.string().cuid(),
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.enum(["RESTOCK", "ADJUSTMENT", "RETURN", "DAMAGE"]),
  note: z.string().trim().max(200).optional(),
});

export async function adjustStockAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await assertPermission("inventory.manage");
  const parsed = adjustSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid quantity." };
  const { variantId, mode, quantity, reason, note } = parsed.data;
  let slug = "";
  try {
    await db.$transaction(async (tx) => {
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, include: { product: { select: { slug: true } } } });
      slug = v.product.slug;
      const next = mode === "set" ? quantity : mode === "add" ? v.stock + quantity : v.stock - quantity;
      if (next < 0) throw new Error(`Can't remove ${quantity} – only ${v.stock} in stock.`);
      const change = next - v.stock;
      if (change === 0) return;
      if (reason === "DAMAGE" && change > 0) throw new Error("Damage write-offs must remove stock.");
      // Damaged units leave sellable stock and are tracked separately.
      const conditional = await tx.productVariant.updateMany({ where: { id: variantId, stock: v.stock }, data: { stock: next, ...(reason === "DAMAGE" ? { damagedStock: { increment: -change } } : {}) } });
      if (conditional.count === 0) throw new Error("Stock changed while you were editing (an order may have just come in) – please retry.");
      await tx.inventoryMovement.create({ data: { variantId, change, stockAfter: next, reason, note: note || null, userId: admin.id } });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update stock." };
  }
  // Only the pages that show this stock, not the whole site: revalidating the
  // root layout threw away every cached storefront page on each adjustment.
  revalidatePath("/admin/inventory");
  revalidatePath("/shop");
  if (slug) revalidatePath(`/products/${slug}`);
  return { success: "Stock updated." };
}

export async function markReviewedAction(productId: string) {
  await assertPermission("products.edit");
  await db.product.update({ where: { id: productId }, data: { needsReview: false } });
  revalidatePath("/admin", "layout");
}

// ─────────── Coupons ───────────

const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().toUpperCase().min(3, "3+ characters").max(30).regex(/^[A-Z0-9_-]+$/, "Letters, numbers, - and _ only"),
  description: z.string().trim().max(200).optional(),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
  value: money.or(z.literal("")).optional(),
  firstOrderOnly: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  productIds: z.array(z.string().cuid()).max(200).default([]),
  categoryIds: z.array(z.string().cuid()).max(100).default([]),
  minSubtotal: money.or(z.literal("")).optional(),
  maxDiscount: money.or(z.literal("")).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  usageLimit: z.string().regex(/^\d*$/).optional(),
  perUserLimit: z.string().regex(/^\d*$/).optional(),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveCouponAction(_: FormState, form: FormData): Promise<FormState> {
  await assertPermission("coupons.manage");
  const parsed = couponSchema.safeParse({ ...Object.fromEntries(form), productIds: form.getAll("productIds"), categoryIds: form.getAll("categoryIds") });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  if (d.type !== "FREE_SHIPPING" && !d.value) return { fieldErrors: { value: "Enter a value" } };
  if (d.type === "PERCENT" && (Number(d.value) <= 0 || Number(d.value) > 100)) return { fieldErrors: { value: "Percent must be 1–100" } };
  const clash = await db.coupon.findFirst({ where: { code: d.code, NOT: d.id ? { id: d.id } : undefined } });
  if (clash) return { fieldErrors: { code: "Code already exists" } };
  const date = (s?: string) => (s ? new Date(`${s}T00:00:00+05:30`) : null);
  const data = {
    code: d.code,
    description: d.description || null,
    type: d.type,
    value: d.type === "FREE_SHIPPING" ? "0" : d.value!,
    firstOrderOnly: d.firstOrderOnly,
    productIds: d.productIds,
    categoryIds: d.categoryIds,
    minSubtotal: d.minSubtotal || null,
    maxDiscount: d.maxDiscount || null,
    startsAt: date(d.startsAt),
    endsAt: d.endsAt ? new Date(`${d.endsAt}T23:59:59+05:30`) : null,
    usageLimit: d.usageLimit ? Number(d.usageLimit) : null,
    perUserLimit: d.perUserLimit ? Number(d.perUserLimit) : null,
    isActive: d.isActive,
  };
  if (d.id) await db.coupon.update({ where: { id: d.id }, data });
  else await db.coupon.create({ data });
  revalidatePath("/admin/coupons");
  return { success: "Coupon saved." };
}

export async function deleteCouponAction(id: string) {
  await assertPermission("coupons.manage");
  const used = await db.order.count({ where: { couponId: id } });
  if (used > 0) await db.coupon.update({ where: { id }, data: { isActive: false } });
  else await db.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
}
