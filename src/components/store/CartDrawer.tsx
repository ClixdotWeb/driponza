"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { formatINR } from "@/lib/money";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

export function QuantityStepper({ variantId, quantity, max }: { variantId: string; quantity: number; max: number }) {
  const { setQty, pending } = useStore();
  return (
    <div className="inline-flex items-center rounded-full border border-cream-200 bg-white">
      <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-botanical-100 disabled:opacity-40" aria-label="Decrease quantity" disabled={pending} onClick={() => setQty(variantId, quantity - 1)}>
        <Minus className="size-3.5" />
      </button>
      <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-botanical-100 disabled:opacity-40" aria-label="Increase quantity" disabled={pending || quantity >= max} onClick={() => setQty(variantId, quantity + 1)}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function CartDrawer({ whatsapp, whatsappOrdering }: { whatsapp: string; whatsappOrdering: boolean }) {
  const { cart, cartOpen, closeCart, remove } = useStore();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, closeCart]);

  useGSAP(
    () => {
      if (!cartOpen || prefersReducedMotion()) return;
      gsap.fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: 0.55, ease: "expo.out" });
      gsap.from("[data-cart-line]", { x: 30, opacity: 0, stagger: 0.05, duration: 0.45, delay: 0.1, ease: "power3.out" });
    },
    { dependencies: [cartOpen] },
  );

  if (!cartOpen) return null;

  const waText = encodeURIComponent(
    `Hello Driponza, I would like to order:\n\n${cart.lines
      .map((l, i) => `${i + 1}. ${l.name} (${l.variantLabel}) x ${l.quantity} = ${formatINR(l.lineTotalPaise)}`)
      .join("\n")}\n\nSubtotal: ${formatINR(cart.subtotalPaise)}\n\nPlease confirm availability and delivery charges.`,
  );

  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-forest-950/45 backdrop-blur-[2px]" onClick={closeCart} />
      <aside ref={panel} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-ivory-50 shadow-2xl outline-none sm:inset-y-2 sm:right-2 sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-cream-200 px-6 py-5">
          <h2 className="display text-3xl">
            Your cart <span className="text-lg text-ink-500">({cart.count})</span>
          </h2>
          <button type="button" onClick={closeCart} className="grid size-10 place-items-center rounded-full hover:bg-cream-100" aria-label="Close cart">
            <X className="size-5" />
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <ShoppingBag className="size-10 text-leaf-500" />
            <p className="display text-3xl">Your cart is empty</p>
            <p className="text-sm text-ink-500">Add some favourites to get started.</p>
            <Link href="/shop" onClick={closeCart} className="btn btn-primary mt-2">
              Explore products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-cream-200 overflow-y-auto px-6">
              {cart.lines.map((line) => (
                <li key={line.id} data-cart-line className="flex gap-4 py-5">
                  <Link href={`/products/${line.productSlug}`} onClick={closeCart} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cream-100">
                    {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/products/${line.productSlug}`} onClick={closeCart} className="text-sm font-medium leading-snug hover:text-green-600">
                        {line.name}
                      </Link>
                      <button type="button" onClick={() => remove(line.variantId)} className="text-ink-500 hover:text-danger-600" aria-label={`Remove ${line.name}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {line.variantLabel} · {formatINR(line.unitPricePaise)}
                    </p>
                    {line.problem && <p className="mt-1 text-xs font-medium text-danger-600">{line.problem}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper variantId={line.variantId} quantity={line.quantity} max={Math.max(line.stock, 1)} />
                      <span className="text-sm font-semibold tabular-nums">{formatINR(line.lineTotalPaise)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-cream-200 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-700">Subtotal</span>
                <span className="display text-3xl tabular-nums">{formatINR(cart.subtotalPaise)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">Shipping and coupons are calculated at checkout.</p>
              <div className="mt-4 grid gap-2">
                <Link href="/checkout" onClick={closeCart} className={`btn btn-primary w-full ${cart.hasProblems ? "pointer-events-none opacity-50" : ""}`} aria-disabled={cart.hasProblems}>
                  Checkout securely
                </Link>
                <Link href="/cart" onClick={closeCart} className="btn btn-outline w-full text-forest-800">
                  View cart
                </Link>
                {whatsappOrdering && (
                  <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="pt-1 text-center text-xs text-ink-500 underline-offset-4 hover:underline">
                    Prefer WhatsApp? Send this order on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
