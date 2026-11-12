import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { toPaise } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export type VariantView = {
  id: string;
  label: string;
  sku: string;
  pricePaise: number;
  mrpPaise: number | null;
  stock: number;
  inStock: boolean;
  lowStock: boolean;
};

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string;
  tag: string | null;
  category: { name: string; slug: string };
  images: { url: string; alt: string }[];
  variants: VariantView[];
};

const productInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, orderBy: [{ position: "asc" }, { price: "asc" }] },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** The brand prefix is kept in the data but dropped on cards where the brand is already obvious. */
export const displayName = (name: string) => name.replace(/^DRIPONZA\s+/i, "");

export function toProductView(p: ProductRow): ProductView {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    displayName: displayName(p.name),
    description: p.description,
    tag: p.tag,
    category: p.category,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? displayName(p.name) })),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      sku: v.sku,
      pricePaise: toPaise(v.price),
      mrpPaise: v.mrp ? toPaise(v.mrp) : null,
      stock: v.stock,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
    })),
  };
}

const visible = { isActive: true, category: { isActive: true } } satisfies Prisma.ProductWhereInput;

export const getFeaturedProducts = cache(async (limit = 8) => {
  const rows = await db.product.findMany({
    where: { ...visible, isFeatured: true },
    include: productInclude,
    orderBy: [{ featuredOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  return rows.map(toProductView);
});

/** Only categories that actually contain visible products are shown on the storefront. */
export const getStoreCategories = cache(async () => {
  const cats = await db.category.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
      products: {
        where: { isActive: true },
        take: 1,
        orderBy: [{ isFeatured: "desc" }, { featuredOrder: "asc" }],
        select: { images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
      },
    },
  });
  return cats
    .filter((c) => c._count.products > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      count: c._count.products,
      image: c.imageUrl ?? c.products[0]?.images[0]?.url ?? null,
    }));
});

export type SortKey = "featured" | "price-asc" | "price-desc" | "name" | "newest";

export async function searchProducts(opts: { q?: string; category?: string; sort?: SortKey; inStock?: boolean }) {
  const q = opts.q?.trim().slice(0, 80);
  const where: Prisma.ProductWhereInput = {
    ...visible,
    ...(opts.category ? { category: { slug: opts.category, isActive: true } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { tag: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(opts.inStock ? { variants: { some: { isActive: true, stock: { gt: 0 } } } } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    opts.sort === "name"
      ? [{ name: "asc" }]
      : opts.sort === "newest"
        ? [{ createdAt: "desc" }]
        : [{ isFeatured: "desc" }, { featuredOrder: "asc" }];

  const rows = await db.product.findMany({ where, include: productInclude, orderBy });
  const views = rows.map(toProductView);
  const minPrice = (p: ProductView) => Math.min(...p.variants.map((v) => v.pricePaise), Number.MAX_SAFE_INTEGER);
  if (opts.sort === "price-asc") views.sort((a, b) => minPrice(a) - minPrice(b));
  if (opts.sort === "price-desc") views.sort((a, b) => minPrice(b) - minPrice(a));
  return views;
}

export const getProductBySlug = cache(async (slug: string) => {
  const row = await db.product.findFirst({ where: { slug, ...visible }, include: productInclude });
  return row ? toProductView(row) : null;
});

export async function getRelatedProducts(product: ProductView, limit = 4) {
  const rows = await db.product.findMany({
    where: { ...visible, id: { not: product.id }, category: { slug: product.category.slug } },
    include: productInclude,
    orderBy: [{ isFeatured: "desc" }, { featuredOrder: "asc" }],
    take: limit,
  });
  return rows.map(toProductView);
}
