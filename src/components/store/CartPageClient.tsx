"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { QuantityStepper } from "@/components/store/CartDrawer";
import { formatINR } from "@/lib/money";

export function CartPageClient({ whatsapp, whatsappOrdering }: { whatsapp: string; whatsappOrdering: boolean }) {
  const { cart, remove } = useStore();

  if (!cart.lines.length) {
    return (
      <div className="mt-10 rounded-[22px] bg-cream-100 px-6 py-20 text-center">
        <p className="display text-4xl">Your cart is empty</p>
        <p className="mt-3 text-ink-500">Discover our carefully selected spices.</p>
        <Link href="/shop" className="btn btn-primary mt-6">Explore products</Link>
      </div>
    );
  }

  const waText = encodeURIComponent(
    `Hello Driponza, I would like to order:\n\n${cart.lines.map((l, i) => `${i + 1}. ${l.name} (${l.variantLabel}) x ${l.quantity} = ${formatINR(l.lineTotalPaise)}`).join("\n")}\n\nSubtotal: ${formatINR(cart.subtotalPaise)}`,
  );

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-cream-200 border-y border-cream-200">
        {cart.lines.map((l) => (
          <li key={l.id} className="grid grid-cols-[88px_1fr] gap-4 py-6 sm:grid-cols-[112px_1fr_auto] sm:items-center">
            <Link href={`/products/${l.productSlug}`} className="relative aspect-square overflow-hidden rounded-2xl bg-cream-100">
              {l.image && <Image src={l.image} alt="" fill sizes="112px" className="object-cover" />}
            </Link>
            <div>
              <Link href={`/products/${l.productSlug}`} className="font-medium hover:text-green-600">{l.name}</Link>
              <p className="mt-1 text-sm text-ink-500">{l.variantLabel} · {formatINR(l.unitPricePaise)} each</p>
              {l.problem && <p className="mt-1 text-sm font-medium text-danger-600">{l.problem}</p>}
              <div className="mt-3 flex items-center gap-4">
                <QuantityStepper variantId={l.variantId} quantity={l.quantity} max={Math.max(l.stock, 1)} />
                <button type="button" onClick={() => remove(l.variantId)} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-danger-600">
                  <Trash2 className="size-4" /> Remove
                </button>
              </div>
            </div>
            <p className="col-start-2 text-right font-semibold tabular-nums sm:col-start-3">{formatINR(l.lineTotalPaise)}</p>
          </li>
        ))}
      </ul>
      <aside className="card h-fit p-6 lg:sticky lg:top-28">
        <h2 className="display text-3xl">Summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-700">Items</dt><dd className="tabular-nums">{cart.count}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-700">Subtotal</dt><dd className="font-semibold tabular-nums">{formatINR(cart.subtotalPaise)}</dd></div>
          <div className="flex justify-between text-ink-500"><dt>Shipping & coupons</dt><dd>At checkout</dd></div>
        </dl>
        {cart.hasProblems && <p className="mt-4 rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">Please fix the highlighted items before checking out.</p>}
        <Link href="/checkout" aria-disabled={cart.hasProblems} className={`btn btn-primary mt-6 w-full py-4 ${cart.hasProblems ? "pointer-events-none opacity-50" : ""}`}>
          Proceed to checkout
        </Link>
        <Link href="/shop" className="btn mt-2 w-full text-forest-800">Continue shopping</Link>
        {whatsappOrdering && (
          <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-xs text-ink-500 underline-offset-4 hover:underline">
            Or send this order on WhatsApp
          </a>
        )}
      </aside>
    </div>
  );
}
