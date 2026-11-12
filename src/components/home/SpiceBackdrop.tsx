"use client";

import { useRef } from "react";
import { BayLeaf, Cardamom, Cinnamon, Clove, Nutmeg, Peppercorn, StarAnise } from "@/components/spices/Spices";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

const SPICES = { star: StarAnise, cardamom: Cardamom, leaf: BayLeaf, cinnamon: Cinnamon, clove: Clove, nutmeg: Nutmeg, pepper: Peppercorn };
export type BackdropItem = { kind: keyof typeof SPICES; className: string; depth?: number };

/**
 * Hero-style floating spices + soft green glow for light sections.
 * Pieces sit at the edges (partly off-canvas) so content stays clear; they drift gently and parallax on scroll.
 */
export function SpiceBackdrop({ items, glow = true, mobile = true }: { items: BackdropItem[]; glow?: boolean; mobile?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>("[data-bd]").forEach((el) => {
        const depth = Number(el.dataset.depth ?? 0.5);
        gsap.to(el.firstElementChild, { y: gsap.utils.random(-12, 12), rotate: gsap.utils.random(-6, 6), duration: gsap.utils.random(4, 7), ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.fromTo(el, { y: 60 * depth }, { y: -90 * depth, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {glow && (
        <>
          <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-leaf-200/35 blur-[110px]" />
          <div className="absolute -bottom-48 -right-32 size-[560px] rounded-full bg-botanical-100 blur-[100px]" />
        </>
      )}
      {items.map((it, i) => {
        const C = SPICES[it.kind];
        return (
          <div key={i} data-bd data-depth={it.depth ?? 0.5} className={`absolute ${mobile ? "" : "hidden md:block"} drop-shadow-[0_18px_20px_rgba(18,61,34,0.28)] ${it.className}`}>
            <div>
              <C uid={`bd-${it.kind}-${i}-${it.className.length}`} className="h-auto w-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
