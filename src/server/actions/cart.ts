"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ensureCartId, getCart, MAX_LINE_QTY, type CartView } from "@/server/cart";

type CartResult = { ok: true; cart: CartView; message?: string } | { ok: false; error: string; cart: CartView };

const idSchema = z.string().cuid();
const qtySchema = z.number().int().min(0).max(MAX_LINE_QTY);

async function sellableVariant(variantId: string) {
  return db.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { isActive: true, category: { isActive: true } } },
    select: { id: true, stock: true, label: true, product: { select: { name: true } } },
  });
}

export async function addToCart(variantId: string, quantity = 1): Promise<CartResult> {
  const limited = await rateLimit("cart", 60, 60_000);
  if (!limited.ok) return { ok: false, error: "Too many requests – please slow down.", cart: await getCart() };
  const id = idSchema.safeParse(variantId);
  const qty = qtySchema.safeParse(quantity);
  if (!id.success || !qty.success || qty.data < 1) return { ok: false, error: "Invalid item", cart: await getCart() };

  const variant = await sellableVariant(id.data);
  if (!variant) return { ok: false, error: "This product is not available.", cart: await getCart() };
  if (variant.stock <= 0) return { ok: false, error: "Sorry, this item is out of stock.", cart: await getCart() };

  const cartId = await ensureCartId();
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId: variant.id } } });
  const wanted = (existing?.quantity ?? 0) + qty.data;
  const capped = Math.min(wanted, variant.stock, MAX_LINE_QTY);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
    create: { cartId, variantId: variant.id, quantity: capped },
    update: { quantity: capped },
  });
  const cart = await getCart();
  if (capped < wanted) return { ok: true, cart, message: `Only ${capped} available – quantity adjusted.` };
  return { ok: true, cart, message: "Added to your cart" };
}

export async function setCartQuantity(variantId: string, quantity: number): Promise<CartResult> {
  const id = idSchema.safeParse(variantId);
  const qty = qtySchema.safeParse(quantity);
  if (!id.success || !qty.success) return { ok: false, error: "Invalid quantity", cart: await getCart() };
  const cartId = await ensureCartId();
  if (qty.data === 0) {
    await db.cartItem.deleteMany({ where: { cartId, variantId: id.data } });
    return { ok: true, cart: await getCart() };
  }
  const variant = await sellableVariant(id.data);
  if (!variant) {
    await db.cartItem.deleteMany({ where: { cartId, variantId: id.data } });
    return { ok: false, error: "This product is no longer available and was removed.", cart: await getCart() };
  }
  const capped = Math.min(qty.data, variant.stock);
  if (capped <= 0) return { ok: false, error: "Sorry, this item is out of stock.", cart: await getCart() };
  await db.cartItem.updateMany({ where: { cartId, variantId: id.data }, data: { quantity: capped } });
  const cart = await getCart();
  return capped < qty.data ? { ok: true, cart, message: `Only ${capped} available.` } : { ok: true, cart };
}

export async function removeFromCart(variantId: string): Promise<CartResult> {
  return setCartQuantity(variantId, 0);
}

export async function refreshCart(): Promise<CartView> {
  return getCart();
}
