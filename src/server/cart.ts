import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { toPaise } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/tokens";
import { displayName } from "@/server/catalog";

export const CART_COOKIE = "dz_cart";
export const MAX_LINE_QTY = 20;

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  variantLabel: string;
  image: string | null;
  unitPricePaise: number;
  mrpPaise: number | null;
  quantity: number;
  stock: number;
  lineTotalPaise: number;
  problem: string | null;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  count: number;
  subtotalPaise: number;
  couponCode: string | null;
  hasProblems: boolean;
};

export const EMPTY_CART: CartView = { id: null, lines: [], count: 0, subtotalPaise: 0, couponCode: null, hasProblems: false };

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              category: { select: { isActive: true } },
              images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
            },
          },
        },
      },
    },
  },
};

/** Locate the current cart without creating one (safe to call from Server Components). */
async function findCart() {
  const user = await getCurrentUser();
  if (user) return db.cart.findUnique({ where: { userId: user.id }, include: cartInclude });
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  return db.cart.findUnique({ where: { guestToken: token }, include: cartInclude });
}

type CartRow = NonNullable<Awaited<ReturnType<typeof findCart>>>;

function toView(cart: CartRow | null): CartView {
  if (!cart) return EMPTY_CART;
  const lines: CartLine[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const sellable = v.isActive && p.isActive && p.category.isActive;
    const unit = toPaise(v.price);
    let problem: string | null = null;
    if (!sellable) problem = "No longer available";
    else if (v.stock <= 0) problem = "Out of stock";
    else if (item.quantity > v.stock) problem = `Only ${v.stock} left`;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      name: displayName(p.name),
      variantLabel: v.label,
      image: p.images[0]?.url ?? null,
      unitPricePaise: unit,
      mrpPaise: v.mrp ? toPaise(v.mrp) : null,
      quantity: item.quantity,
      stock: v.stock,
      lineTotalPaise: unit * item.quantity,
      problem,
    };
  });
  return {
    id: cart.id,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.filter((l) => !l.problem).reduce((n, l) => n + l.lineTotalPaise, 0),
    couponCode: cart.couponCode,
    hasProblems: lines.some((l) => l.problem),
  };
}

export async function getCart(): Promise<CartView> {
  return toView(await findCart());
}

/** Find or create the cart – only from Server Actions / Route Handlers (may set a cookie). */
export async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    return cart.id;
  }
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (token) {
    const existing = await db.cart.findUnique({ where: { guestToken: token }, select: { id: true } });
    if (existing) return existing.id;
  }
  const newToken = randomToken(24);
  const cart = await db.cart.create({ data: { guestToken: newToken } });
  jar.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return cart.id;
}

/** Called after login/registration: moves guest cart lines into the customer's cart. */
export async function mergeGuestCart(userId: string) {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;
  const guest = await db.cart.findUnique({ where: { guestToken: token }, include: { items: true } });
  jar.delete(CART_COOKIE);
  if (!guest) return;
  const userCart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  await db.$transaction(async (tx) => {
    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } } });
      const quantity = Math.min(MAX_LINE_QTY, (existing?.quantity ?? 0) + item.quantity);
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: { cartId: userCart.id, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
