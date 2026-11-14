"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Reveals each direct child as it scrolls into view (staggered in batches).
 * Children are hidden by CSS only while JS is active (see globals.css), so nothing is lost without JS.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  y = 40,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "section";
  y?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const items = Array.from(ref.current!.children) as HTMLElement[];
      if (prefersReducedMotion()) return gsap.set(items, { autoAlpha: 1 });

      // Anything already on screen when this runs is shown at once. The CSS hides
      // these children until hydration, so on a slow connection the reader can be
      // looking at a blank section; animating it in then reads as a delay, and
      // scrolling past before hydration would have left it blank until the failsafe.
      const fold = window.innerHeight * 0.92;
      const visible = items.filter((el) => el.getBoundingClientRect().top < fold);
      const pending = items.filter((el) => !visible.includes(el));

      if (visible.length) gsap.set(visible, { autoAlpha: 1, y: 0 });
      if (!pending.length) return;

      gsap.set(pending, { autoAlpha: 0, y });
      ScrollTrigger.batch(pending, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out", stagger, overwrite: true }),
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref as never} data-reveal className={className}>
      {children}
    </Tag>
  );
}

/** Words light up one by one as the paragraph scrolls through the viewport. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ref.current!.querySelectorAll("[data-word]"),
        { opacity: 0.16 },
        { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top 80%", end: "bottom 45%", scrub: 0.6 } },
      );
    },
    { scope: ref },
  );
  return (
    <p ref={ref} className={className}>
      {text.split(/\s+/).map((w, i) => (
        <span key={i} data-word className="inline-block whitespace-pre">
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/** Image that zooms out slightly and drifts as the section scrolls past. */
export function ParallaxMedia({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const inner = ref.current!.firstElementChild!;
      gsap.fromTo(inner, { scale: 1.18, yPercent: -6 }, { scale: 1.02, yPercent: 6, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.from(ref.current, { clipPath: "inset(12% 12% 12% 12% round 28px)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ref.current, start: "top 80%", once: true } });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
