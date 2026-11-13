import type { MetadataRoute } from "next";

const base = process.env.APP_URL || "http://localhost:3000";

/**
 * Crawlers may read the shop, but nothing personal or operational: the admin,
 * accounts, carts, checkout, order pages and API routes are all off limits.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/account", "/account/", "/api/", "/cart", "/checkout", "/order/", "/track", "/wishlist", "/media/private"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
