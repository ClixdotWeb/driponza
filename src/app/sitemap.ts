import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const base = process.env.APP_URL || "http://localhost:3000";

/** Revalidate hourly: new products should reach Google without a redeploy. */
export const revalidate = 3600;

/**
 * Public pages only — everything a customer can reach without signing in.
 * Hidden products and inactive categories are left out by the same rules the
 * shop uses, so nothing unpublished leaks into search results.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true }, orderBy: { position: "asc" } }),
  ]).catch(() => [[], []] as const);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/our-story`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
    ...(["privacy", "terms", "shipping", "returns"] as const).map((slug) => ({
      url: `${base}/policies/${slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  return [
    ...staticPages,
    ...categories.map((c) => ({ url: `${base}/shop?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
