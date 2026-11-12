"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { BayLeaf, Cardamom, Cinnamon, Peppercorn, StarAnise } from "@/components/spices/Spices";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

type SpiceLink = { label: string; href: string | null };

/**
 * Brand moment built around the "heart of spices" photograph, in the hero's green language.
 * Copy uses only Driponza's own phrases; spice chips link to the real products shown in the handful.
 */
export function HandfulFeature({ spices }: { spices: SpiceLink[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from("[data-hf-panel]", { clipPath: "inset(8% 5% 8% 5% round 48px)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ref.current, start: "top 75%", once: true } });
      gsap.from("[data-hf-photo]", { y: 70, rotate: 4, autoAlpha: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ref.current, start: "top 70%", once: true } });
      gsap.to("[data-hf-photo] > div", { y: -10, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.utils.toArray<HTMLElement>("[data-hf-spice]").forEach((s, i) => {
        gsap.to(s, { y: -12 - i * 3, rotate: i % 2 ? 8 : -8, duration: 3.2 + i * 0.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.fromTo(s, { yPercent: 25 }, { yPercent: -35, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
      const path = ref.current!.querySelector<SVGPathElement>("[data-hf-draw]");
      if (path) {
        const len = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", scrollTrigger: { trigger: ref.current, start: "top 60%", once: true } });
      }
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="px-2 md:px-3">
      <div data-hf-panel className="hero-surface grain relative isolate overflow-hidden rounded-[var(--radius-panel)] text-ivory-50">
        {/* floating spices, kept to the edges and smaller on phones */}
        <div data-hf-spice className="pointer-events-none absolute -left-6 bottom-8 w-14 rotate-[-20deg] drop-shadow-2xl md:left-[3%] md:w-24"><Cardamom uid="hf1" className="h-auto w-full" /></div>
        <div data-hf-spice className="pointer-events-none absolute right-6 top-6 w-12 drop-shadow-2xl md:right-[38%] md:top-10 md:w-16"><StarAnise uid="hf2" className="h-auto w-full" /></div>
        <div data-hf-spice className="pointer-events-none absolute -bottom-6 -right-10 w-40 rotate-[-24deg] drop-shadow-2xl md:right-[-3%] md:w-80"><Cinnamon uid="hf3" className="h-auto w-full" /></div>
        <div data-hf-spice className="pointer-events-none absolute right-[8%] top-[14%] hidden w-14 rotate-[40deg] drop-shadow-2xl lg:block"><BayLeaf uid="hf4" className="h-auto w-full" /></div>
        <div data-hf-spice className="pointer-events-none absolute left-[46%] bottom-[14%] hidden w-3.5 md:block"><Peppercorn uid="hf5" className="h-auto w-full" /></div>

        <div className="relative z-10 grid items-center gap-10 px-5 py-14 md:px-14 md:py-24 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          {/* Photo */}
          <div data-hf-photo className="relative mx-auto w-full max-w-[270px] sm:max-w-[340px] lg:max-w-[440px]">
            <div className="relative aspect-[4/5] -rotate-3 overflow-hidden rounded-[24px] shadow-[0_50px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-ivory-50/20 md:rounded-[28px]">
              <Image src="/brand/story.jpg" alt="Two hands holding a heart shaped from cardamom, cloves, star anise, black pepper, coriander seeds and cinnamon" fill sizes="(min-width:1024px) 440px, (min-width:640px) 340px, 270px" className="object-cover" />
            </div>
            <div className="pointer-events-none absolute -right-10 -top-12 hidden text-ivory-50/85 md:block lg:-right-24">
              <p className="rotate-[-6deg] font-[family-name:var(--font-script)] text-3xl">Chosen with care</p>
              <svg viewBox="0 0 160 110" className="ml-2 mt-1 w-32" fill="none" aria-hidden="true">
                <path data-hf-draw d="M140 10 C 150 50, 120 70, 95 60 C 72 52, 82 28, 100 36 C 120 46, 90 90, 40 95 L 18 96 M 18 96 L 30 86 M 18 96 L 30 104" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Copy */}
          <div className="text-center lg:text-left">
            <p className="eyebrow text-leaf-200">Nurture • Grow • Thrive</p>
            <h2 className="display mt-5 text-[clamp(2.6rem,8vw,5.6rem)] leading-[0.92]">
              A handful of <em className="text-leaf-200">good things.</em>
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-ivory-50/80 lg:mx-0">
              Fragrant cardamom, bold cloves, star anise, black pepper and warm cassia cinnamon — every Driponza spice is carefully selected for rich aroma and authentic flavour, then packed with care so it reaches your kitchen just as it should.
            </p>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.2em] text-ivory-50/60">In this handful</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                {spices.map((s) => (
                  <li key={s.label}>
                    {s.href ? (
                      <Link href={s.href} className="inline-flex rounded-full border border-ivory-50/30 px-4 py-2 text-sm text-ivory-50/90 transition hover:border-ivory-50 hover:bg-ivory-50 hover:text-forest-900">
                        {s.label}
                      </Link>
                    ) : (
                      <span className="inline-flex rounded-full border border-ivory-50/20 px-4 py-2 text-sm text-ivory-50/60">{s.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/shop" className="btn btn-leaf px-8 py-4 text-[15px]">
                Explore the collection <ArrowRight className="size-4" />
              </Link>
              <Link href="/our-story" className="btn btn-ivory px-8 py-4 text-[15px]">
                Our story
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
