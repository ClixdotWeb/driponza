"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export type FaqItem = { q: string; a: React.ReactNode };

function Row({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const body = useRef<HTMLDivElement>(null);
  const toggle = () => {
    const el = body.current!;
    const next = !open;
    setOpen(next);
    if (prefersReducedMotion()) return gsap.set(el, next ? { height: "auto", autoAlpha: 1 } : { height: 0, autoAlpha: 0 });
    if (next) gsap.fromTo(el, { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration: 0.55, ease: "expo.out" });
    else gsap.to(el, { height: 0, autoAlpha: 0, duration: 0.35, ease: "power2.in" });
  };
  return (
    <div className="border-b border-forest-800/15">
      <h3>
        <button type="button" onClick={toggle} aria-expanded={open} className="group flex w-full items-center justify-between gap-6 py-6 text-left">
          <span className="flex items-baseline gap-4">
            <span className="section-index w-6 shrink-0 text-sm">{String(index + 1).padStart(2, "0")}</span>
            <span className="display text-2xl leading-tight transition-colors group-hover:text-green-600 md:text-[28px]">{item.q}</span>
          </span>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border border-forest-800/20 transition duration-500", open ? "rotate-45 border-green-600 bg-green-600 text-ivory-50" : "text-forest-800 group-hover:border-forest-800")}>
            <Plus className="size-4" />
          </span>
        </button>
      </h3>
      {/* Initial state only – afterwards GSAP owns height/visibility so the close animation can play. */}
      <div ref={body} className="overflow-hidden" style={index === 0 ? undefined : { height: 0, visibility: "hidden" }}>
        <div className="max-w-2xl pb-7 pl-10 text-[15px] leading-relaxed text-ink-700">{item.a}</div>
      </div>
    </div>
  );
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="border-t border-forest-800/15">
      {items.map((item, i) => (
        <Row key={item.q} item={item} index={i} />
      ))}
    </div>
  );
}
