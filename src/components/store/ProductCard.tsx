"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { formatINR } from "@/lib/money";
import { cn, shortSpiceName } from "@/lib/utils";
import type { ProductView, VariantView } from "@/server/catalog";

export function Price({ variant, size = "md" }: { variant: VariantView; size?: "md" | "lg" }) {
  const off = variant.mrpPaise && variant.mrpPaise > variant.pricePaise ? Math.round((1 - variant.pricePaise / variant.mrpPaise) * 100) : 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("font-semibold tabular-nums text-forest-900", size === "lg" ? "display text-4xl font-normal" : "text-base")}>{formatINR(variant.pricePaise)}</span>
      {off > 0 && (
        <>
          <s className="text-xs text-ink-500 tabular-nums">{formatINR(variant.mrpPaise!)}</s>
          <span className="text-xs font-medium text-green-600">{off}% off</span>
        </>
      )}
    </div>
  );
}

export function StockBadge({ variant }: { variant: VariantView }) {
  if (!variant.inStock) return <span className="text-xs font-medium text-danger-600">Out of stock</span>;
  if (variant.lowStock) return <span className="text-xs font-medium text-warning-500">Only {variant.stock} left</span>;
  return <span className="text-xs font-medium text-green-600">In stock</span>;
}

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { wishlist, toggleWishlist } = useStore();
  const active = wishlist.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggleWishlist(productId);
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      className={cn("grid size-10 place-items-center rounded-full bg-ivory-50/90 text-forest-800 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-ivory-50", className)}
    >
      <Heart className={cn("size-4 transition", active && "fill-green-600 text-green-600")} />
    </button>
  );
}

/**
 * Editorial product card: a clean, uncluttered photo (only a quiet wishlist heart on it),
 * then a consistent information block — serif name, details line, price, and a hairline
 * action row with stock status and "Add to cart".
 */
export function ProductCard({ product, priority = false }: { product: ProductView; priority?: boolean; index?: number }) {
  const { add } = useStore();
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.inStock)?.id ?? product.variants[0]?.id);
  const [busy, setBusy] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const [img] = product.images; // main image is always the text-free spice photo
  const name = shortSpiceName(product.name);
  const off = variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? Math.round((1 - variant.pricePaise / variant.mrpPaise) * 100) : 0;
  const soldOut = !variant?.inStock;

  const addNow = async () => {
    if (!variant) return;
    setBusy(true);
    await add(variant.id, 1);
    setBusy(false);
  };

  return (
    <article data-product-card className="group flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-cream-100">
        <Link href={`/products/${product.slug}`} className="absolute inset-0" aria-label={product.displayName}>
          {img && (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              priority={priority}
              sizes="(min-width:1024px) 25vw, 50vw"
              className={cn(
                "object-cover transition duration-[1600ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.05]",
                soldOut && "saturate-[0.55]",
              )}
            />
          )}
          {/* soft inner vignette so photos sit like prints rather than stickers */}
          <span className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[inset_0_0_0_1px_rgba(18,61,34,0.08),inset_0_-60px_80px_-60px_rgba(7,23,13,0.35)]" />
        </Link>
        <WishlistButton
          productId={product.id}
          className="absolute right-3 top-3 size-9 bg-ivory-50/80 opacity-100 transition duration-500 lg:translate-y-1 lg:opacity-0 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-4">
        <h3 className="display truncate text-[22px] leading-tight sm:text-[27px]">
          <Link href={`/products/${product.slug}`} className="transition-colors hover:text-green-600">{name}</Link>
        </h3>
        <p className="mt-1 truncate text-[12px] text-ink-500 sm:text-[13px]">
          {product.variants.length > 1 ? `${product.variants.length} sizes` : variant?.label}
          <span className="mx-1.5 text-cream-200">/</span>
          {product.category.name}
        </p>

        {product.variants.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Weight">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variantId}
                onClick={() => setVariantId(v.id)}
                className={cn("rounded-full border px-2.5 py-0.5 text-[11px] transition", v.id === variantId ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200 text-ink-700 hover:border-forest-800")}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {variant && (
          <p className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-[17px] font-semibold text-forest-900">{formatINR(variant.pricePaise)}</span>
            {off > 0 && (
              <>
                <s className="text-[13px] text-ink-500">{formatINR(variant.mrpPaise!)}</s>
                <span className="text-[12px] font-medium text-green-600">−{off}%</span>
              </>
            )}
          </p>
        )}

        <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-2 border-t border-forest-800/10 pt-3">
          <span className={cn("flex items-center gap-1.5 text-[12px]", soldOut ? "text-ink-500" : variant?.lowStock ? "text-warning-500" : "text-green-600")}>
            <span className={cn("size-1.5 rounded-full", soldOut ? "bg-ink-500/50" : variant?.lowStock ? "bg-warning-500" : "bg-green-600")} />
            {soldOut ? "Out of stock" : variant?.lowStock ? `Only ${variant.stock} left` : "In stock"}
          </span>
          {variant && !soldOut && (
            <button
              type="button"
              disabled={busy}
              onClick={addNow}
              aria-label={`Add ${product.displayName} ${variant.label} to cart`}
              className="group/add inline-flex items-center gap-2 text-[13px] font-medium text-forest-900 transition hover:text-green-600 disabled:opacity-50"
            >
              <span className="hidden sm:inline">{busy ? "Adding…" : "Add to cart"}</span>
              <span className="grid size-8 place-items-center rounded-full bg-forest-800 text-ivory-50 transition duration-300 group-hover/add:rotate-90 group-hover/add:bg-green-600">
                <Plus className={cn("size-4", busy && "animate-spin")} />
              </span>
            </button>
          )}
        </div>
        </div>
      </div>
    </article>
  );
}
