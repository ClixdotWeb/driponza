"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { Price, StockBadge, WishlistButton } from "@/components/store/ProductCard";
import { cn } from "@/lib/utils";
import type { VariantView } from "@/server/catalog";

export function ProductPurchase({ productId, variants }: { productId: string; variants: VariantView[] }) {
  const { add } = useStore();
  const [variantId, setVariantId] = useState(variants.find((v) => v.inStock)?.id ?? variants[0].id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const max = Math.min(variant.stock, 20);

  return (
    <div className="mt-8">
      <Price variant={variant} size="lg" />
      <div className="mt-1"><StockBadge variant={variant} /></div>

      <fieldset className="mt-7">
        <legend className="field-label">Weight</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === variantId}
              onClick={() => {
                setVariantId(v.id);
                setQty(1);
              }}
              className={cn(
                "rounded-full border px-5 py-2.5 text-sm transition",
                v.id === variantId ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200 bg-white hover:border-forest-800",
                !v.inStock && "line-through opacity-60",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-cream-200 bg-white">
          <button type="button" className="grid size-12 place-items-center rounded-full hover:bg-botanical-100 disabled:opacity-40" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
          <button type="button" className="grid size-12 place-items-center rounded-full hover:bg-botanical-100 disabled:opacity-40" aria-label="Increase quantity" disabled={qty >= max} onClick={() => setQty((q) => q + 1)}>
            <Plus className="size-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={!variant.inStock || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await add(variant.id, qty);
            setBusy(false);
            if (ok) setQty(1);
          }}
          className="btn btn-primary h-12 flex-1 px-8 text-[15px]"
        >
          <ShoppingBag className="size-4" />
          {!variant.inStock ? "Out of stock" : busy ? "Adding…" : "Add to cart"}
        </button>
        <WishlistButton productId={productId} className="size-12 border border-cream-200" />
      </div>
      <p className="mt-3 text-xs text-ink-500">SKU {variant.sku}</p>
    </div>
  );
}
