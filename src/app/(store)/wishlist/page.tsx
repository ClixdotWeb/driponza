import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/store/ProductCard";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { toProductView } from "@/server/catalog";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const user = await requireUser("/wishlist");
  const items = await db.wishlistItem.findMany({
    where: { userId: user.id, product: { isActive: true } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          category: { select: { name: true, slug: true } },
          images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
          variants: { where: { isActive: true }, orderBy: [{ position: "asc" }, { price: "asc" }] },
        },
      },
    },
  });
  return (
    <section className="container-x py-10 md:py-14">
      <p className="eyebrow text-green-600">Saved for later</p>
      <h1 className="display mt-3 text-[clamp(2.6rem,5vw,4.2rem)]">Your wishlist</h1>
      {items.length ? (
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4">
          {items.map((i) => (
            <ProductCard key={i.id} product={toProductView(i.product)} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-[22px] bg-cream-100 px-6 py-16 text-center">
          <p className="display text-3xl">Nothing saved yet</p>
          <p className="mt-2 text-ink-500">Tap the heart on any product to save it here.</p>
          <Link href="/shop" className="btn btn-primary mt-6">Browse spices</Link>
        </div>
      )}
    </section>
  );
}
