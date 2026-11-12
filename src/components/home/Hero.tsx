"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { BayLeaf, Cardamom, Cinnamon, StarAnise } from "@/components/spices/Spices";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText);

export type HeroProduct = { slug: string; name: string; label: string; image: string; pricePaise: number };

type Props = {
  eyebrow: string;
  line1: string;
  line2: string;
  text: string;
  annotations: string[];
  whatsapp: string;
  products: HeroProduct[];
};

/** depth: how strongly the piece reacts to mouse/scroll parallax (0 = static, 1 = strong). */
function Floating({ className, depth, children, mobile = true, soft = false }: { className: string; depth: number; children: React.ReactNode; mobile?: boolean; soft?: boolean }) {
  return (
    <div data-animate data-spice data-depth={depth} className={`pointer-events-none absolute ${mobile ? "" : "hidden md:block"} ${soft ? "opacity-80 blur-[1.5px]" : ""} ${className}`}>
      <div data-float>
        <div data-mouse className="drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]">{children}</div>
      </div>
    </div>
  );
}

/** A rotating fan of real spice photos: every few seconds the cards turn one step around the circle. */
function ProductShowcase({ products }: { products: HeroProduct[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = products.length;
  useEffect(() => {
    if (n < 2 || paused || prefersReducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 3800);
    return () => clearInterval(t);
  }, [n, paused]);
  if (!n) return null;
  // Position of each card on the wheel: front, next (right), previous (left) or tucked behind.
  const role = (k: number) => {
    const d = (k - i + n) % n;
    return d === 0 ? "front" : d === 1 ? "next" : d === n - 1 ? "prev" : "back";
  };
  // Same transform-function order in every pose so the browser interpolates them smoothly on the GPU.
  const pose = {
    front: { z: 30, o: 1, t: "translate3d(0,0,0) rotateY(0deg) rotateZ(0deg) scale(1)" },
    next: { z: 20, o: 1, t: "translate3d(var(--spread),6%,0) rotateY(-16deg) rotateZ(9deg) scale(0.8)" },
    prev: { z: 20, o: 1, t: "translate3d(calc(var(--spread) * -1),6%,0) rotateY(16deg) rotateZ(-9deg) scale(0.8)" },
    back: { z: 0, o: 0, t: "translate3d(0,5%,0) rotateY(0deg) rotateZ(0deg) scale(0.62)" },
  } as const;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative aspect-[4/5] [--spread:30%] [perspective:1400px] md:[--spread:36%]">
        {products.map((x, k) => {
          const r = role(k);
          const front = r === "front";
          return (
            <Link
              key={x.slug}
              href={`/products/${x.slug}`}
              tabIndex={front ? 0 : -1}
              aria-hidden={!front}
              aria-label={front ? `View ${x.name}` : undefined}
              onClick={(e) => {
                if (!front) {
                  e.preventDefault();
                  setI(k);
                }
              }}
              className={cn(
                "absolute inset-0 overflow-hidden rounded-[24px] border border-ivory-50/15 bg-forest-900 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] [backface-visibility:hidden] [will-change:transform,opacity] [transition:transform_1400ms_cubic-bezier(0.22,1,0.36,1),opacity_900ms_ease,z-index_1400ms_cubic-bezier(0.22,1,0.36,1)]",
                r === "back" && "pointer-events-none",
              )}
              style={{ transform: pose[r].t, opacity: pose[r].o, zIndex: pose[r].z }}
            >
              <Image src={x.image} alt={front ? x.name : ""} fill priority sizes="(min-width:1024px) 380px, 280px" className={cn("object-cover transition-transform duration-[4000ms] ease-out", front && !paused ? "scale-[1.05]" : "scale-100")} />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-forest-950/95 via-forest-950/50 to-transparent" />
              {/* Label shows on the front card only */}
              <div className={cn("absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 transition-[opacity,translate] duration-700 ease-out", front ? "translate-y-0 opacity-100 delay-500" : "translate-y-2 opacity-0")}>
                <div className="min-w-0">
                  <p className="display truncate text-[30px] leading-none text-ivory-50 md:text-[38px]">{x.name}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-leaf-200 md:text-[11px]"><span className="hidden lg:inline">Whole spice · </span>{x.label}</p>
                </div>
                <span className="shrink-0 rounded-full bg-ivory-50 px-3.5 py-1.5 text-sm font-semibold text-forest-900">{formatINR(x.pricePaise)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 -bottom-14 z-40 flex justify-center gap-1.5">
        {products.map((x, k) => (
          <button key={x.slug} type="button" onClick={() => setI(k)} aria-label={`Show ${x.name}`} aria-current={k === i} className="grid h-5 place-items-center px-0.5">
            <span className={cn("block h-1 rounded-full transition-all duration-500", k === i ? "w-7 bg-leaf-300" : "w-1.5 bg-ivory-50/30 hover:bg-ivory-50/60")} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Hero({ eyebrow, line1, line2, text, annotations, whatsapp, products }: Props) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      // Unhide first: "from" tweens use the current state as their end state, so it must be visible.
      gsap.set(q("[data-animate]"), { autoAlpha: 1 });
      if (prefersReducedMotion()) return;

      const split = SplitText.create(q("[data-headline]"), { type: "lines,words", mask: "lines", linesClass: "pb-[0.08em]" });
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(el.querySelector("[data-panel]"), { clipPath: "inset(6% 4% 6% 4% round 40px)", duration: 1.4, ease: "expo.inOut" }, 0)
        .from(q("[data-eyebrow]"), { x: -20, autoAlpha: 0, duration: 0.8 }, 0.45)
        .from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.5)
        .from(q("[data-sub]"), { y: 24, autoAlpha: 0, duration: 0.9 }, 0.9)
        .from(q("[data-cta] > *"), { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.8 }, 1.0)
        .from(q("[data-orbit]"), { scale: 0.6, autoAlpha: 0, duration: 1.6 }, 0.5)
        .from(q("[data-showcase]"), { y: 90, rotate: 10, autoAlpha: 0, duration: 1.5 }, 0.6)
        .from(q("[data-spice]"), { autoAlpha: 0, scale: 0.4, rotation: () => gsap.utils.random(-90, 90), duration: 1.6, stagger: { each: 0.05, from: "random" } }, 0.5)
        .from(q("[data-note]"), { autoAlpha: 0, y: 10, duration: 0.8 }, 1.5);

      q("[data-draw]").forEach((path) => {
        const p = path as unknown as SVGPathElement;
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(p, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" }, 1.6);
      });

      // Idle motion
      gsap.to(q("[data-orbit]"), { rotate: 360, duration: 60, ease: "none", repeat: -1 });
      q("[data-float]").forEach((f) =>
        gsap.to(f, { y: gsap.utils.random(-14, 14), rotation: gsap.utils.random(-6, 6), duration: gsap.utils.random(3.2, 5.8), ease: "sine.inOut", yoyo: true, repeat: -1, delay: gsap.utils.random(0, 1.5) }),
      );

      // Scroll parallax
      q("[data-spice]").forEach((s) => {
        const depth = Number((s as HTMLElement).dataset.depth ?? 0.5);
        gsap.to(s, { y: -160 * depth, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      });
      gsap.fromTo(q("[data-showcase-parallax]"), { y: 0 }, { y: -60, ease: "none", immediateRender: false, scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });

      // Mouse parallax (fine pointers only)
      if (!window.matchMedia("(pointer: fine)").matches) return () => split.revert();
      const movers = q("[data-spice]").map((s) => {
        const depth = Number((s as HTMLElement).dataset.depth ?? 0.5);
        const m = s.querySelector("[data-mouse]") ?? s;
        return { depth, x: gsap.quickTo(m, "x", { duration: 1.2, ease: "power3.out" }), y: gsap.quickTo(m, "y", { duration: 1.2, ease: "power3.out" }) };
      });
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        movers.forEach((m) => {
          m.x(nx * 44 * m.depth);
          m.y(ny * 34 * m.depth);
        });
      };
      el.addEventListener("pointermove", onMove);
      return () => {
        el.removeEventListener("pointermove", onMove);
        split.revert();
      };
    },
    { scope: root },
  );

  useGSAP(() => {
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });

  return (
    <section ref={root} aria-labelledby="hero-title" className="relative px-2 pb-2 md:px-3 md:pb-3">
      <div data-panel className="hero-surface grain relative isolate overflow-hidden rounded-[var(--radius-panel)] lg:min-h-[calc(100svh-7rem)]">
        {/* Floating ingredients (edges only) */}
        <Floating depth={0.9} className="-left-12 top-[6%] w-40 -rotate-[64deg] md:-left-6 md:w-60">
          <Cinnamon uid="h1" className="h-auto w-full" />
        </Floating>
        <Floating depth={1} className="-right-6 top-[2%] w-14 rotate-[38deg] md:right-[2%] md:top-[4%] md:w-20">
          <BayLeaf uid="h3" className="h-auto w-full" />
        </Floating>
        <Floating depth={0.3} mobile={false} soft className="left-[47%] top-[9%] w-9 -rotate-[30deg]">
          <Cardamom uid="h5" className="h-auto w-full" />
        </Floating>
        <Floating depth={0.4} soft className="-bottom-8 -left-8 w-20 md:-bottom-10 md:left-[36%] md:w-24">
          <StarAnise uid="h6" className="h-auto w-full" />
        </Floating>

        <div className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-10 pt-7 sm:px-8 md:min-h-[620px] md:grid-cols-[1.12fr_0.88fr] md:gap-8 md:px-10 md:py-16 lg:min-h-[calc(100svh-7rem)] lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:px-12">
          {/* Copy */}
          <div data-copy className="min-w-0 text-ivory-50">
            <p data-animate data-eyebrow className="eyebrow flex items-center gap-3 text-leaf-200">
              <span className="h-px w-8 bg-leaf-200/60" /> {eyebrow}
            </p>
            <h1 id="hero-title" data-animate data-headline className="display mt-6 text-[clamp(2.7rem,6vw,5.4rem)] leading-[0.96]">
              <span className="block">{line1}</span>
              <span className="block italic text-leaf-200">{line2}</span>
            </h1>
            <p data-animate data-sub className="mt-7 max-w-lg text-[15px] leading-relaxed text-ivory-50/80 md:text-base">{text}</p>
            <div data-cta className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link data-animate href="/shop" className="btn btn-leaf px-7 py-4 text-[15px]">
                Explore products <ArrowRight className="size-4" />
              </Link>
              <Link data-animate href="/our-story" className="btn border border-ivory-50/30 px-7 py-4 text-[15px] text-ivory-50 hover:border-ivory-50 hover:bg-ivory-50 hover:text-forest-900">
                Our story
              </Link>
            </div>
          </div>

          {/* Visual */}
          <div className="relative order-first mx-auto mb-12 -mt-3 w-full max-w-[230px] sm:max-w-[270px] md:order-none md:mb-10 md:mt-0 md:-translate-y-6 lg:-translate-y-14 lg:max-w-[340px] xl:max-w-[360px]">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[44%] size-[165%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(159,207,126,0.30)_0%,rgba(76,154,63,0.12)_38%,transparent_64%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[44%] size-[128%] -translate-x-1/2 -translate-y-1/2">
              {/* inner ring rotates; the outer wrapper keeps it centred */}
              <div data-animate data-orbit className="size-full rounded-full border border-leaf-200/20">
              </div>
            </div>
            <div data-showcase-parallax className="relative">
            <div data-animate data-showcase className="relative">
              {products.length > 0 && <ProductShowcase products={products} />}
            </div>
            </div>


            <div className="pointer-events-none absolute -left-[30%] -top-16 z-50 hidden text-ivory-50/85 lg:block">
              <p data-animate data-note className="-rotate-6 font-[family-name:var(--font-script)] text-2xl">{annotations[0]}</p>
              <svg viewBox="0 0 120 80" className="ml-24 -mt-1 w-24" fill="none" aria-hidden="true">
                <path data-draw d="M10 10 C 40 0, 70 10, 70 30 C 70 48, 46 46, 50 32 C 54 18, 90 30, 100 62 M 100 62 L 90 55 M 100 62 L 104 50" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Corner notch with a contact pill */}
        <div className="absolute bottom-0 right-0 z-20 hidden md:block">
          <div className="relative rounded-tl-[22px] bg-ivory-50 pl-3 pt-3">
            <span aria-hidden className="absolute -top-[22px] right-0 size-[22px] bg-[radial-gradient(circle_at_0_0,transparent_21.5px,var(--color-ivory-50)_22px)]" />
            <span aria-hidden className="absolute -left-[22px] bottom-0 size-[22px] bg-[radial-gradient(circle_at_0_0,transparent_21.5px,var(--color-ivory-50)_22px)]" />
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
              <MessageCircle className="size-4" /> Talk to us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
