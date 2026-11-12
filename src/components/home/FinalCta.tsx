"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { BayLeaf, Cardamom, Cinnamon, Peppercorn, StarAnise } from "@/components/spices/Spices";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

export function FinalCta({ title, text }: { title: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: "top 75%", once: true } });
      tl.from(ref.current, { clipPath: "inset(10% 6% 10% 6% round 60px)", duration: 1.4, ease: "expo.out" })
        .from("[data-cta-line]", { yPercent: 100, autoAlpha: 0, stagger: 0.1, duration: 1, ease: "expo.out" }, 0.2)
        .from("[data-cta-spice]", { scale: 0.3, autoAlpha: 0, rotation: 60, stagger: 0.08, duration: 1.4, ease: "expo.out" }, 0.1);
      gsap.utils.toArray<HTMLElement>("[data-cta-spice]").forEach((s, i) => {
        gsap.to(s, { y: i % 2 ? -60 : 50, rotation: i % 2 ? 15 : -12, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="hero-surface grain relative isolate overflow-hidden rounded-[var(--radius-panel)] px-6 py-24 text-center text-ivory-50 md:py-36">
      <div data-cta-spice className="pointer-events-none absolute -left-16 top-8 w-56 rotate-[-30deg] drop-shadow-2xl md:w-80"><Cinnamon uid="c1" className="h-auto w-full" /></div>
      <div data-cta-spice className="pointer-events-none absolute -right-4 top-6 w-20 drop-shadow-2xl md:right-[10%] md:w-28"><StarAnise uid="c2" className="h-auto w-full" /></div>
      <div data-cta-spice className="pointer-events-none absolute -bottom-10 right-[6%] w-24 rotate-[50deg] drop-shadow-2xl md:w-32"><BayLeaf uid="c3" className="h-auto w-full" /></div>
      <div data-cta-spice className="pointer-events-none absolute bottom-10 left-[12%] hidden w-12 rotate-[-25deg] drop-shadow-2xl md:block"><Cardamom uid="c4" className="h-auto w-full" /></div>
      <div data-cta-spice className="pointer-events-none absolute left-[30%] top-[20%] w-3 drop-shadow-xl"><Peppercorn uid="c5" className="h-auto w-full" /></div>
      <div data-cta-spice className="pointer-events-none absolute bottom-[22%] right-[30%] w-3.5 drop-shadow-xl"><Peppercorn uid="c6" className="h-auto w-full" /></div>

      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="overflow-hidden"><p data-cta-line className="font-[family-name:var(--font-script)] text-3xl text-leaf-200">Ready to cook?</p></div>
        <div className="overflow-hidden pb-2"><h2 data-cta-line className="display mt-3 text-[clamp(2.8rem,7vw,6rem)]">{title}</h2></div>
        <div className="overflow-hidden"><p data-cta-line className="mx-auto mt-5 max-w-md text-ivory-50/75">{text}</p></div>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/shop" className="btn btn-leaf px-7 py-4 text-[15px]">Shop the collection <ArrowRight className="size-4" /></Link>
        </div>
      </div>
    </div>
  );
}
