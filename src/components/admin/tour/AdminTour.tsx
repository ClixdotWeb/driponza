"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { tourFor, type TourStep } from "@/components/admin/tour/steps";
import { cn } from "@/lib/utils";

type Box = { top: number; left: number; width: number; height: number };

const PAD = 10;
const CARD_W = 340;
const GAP = 14;
const seenKey = (id: string) => `dz-tour:${id}`;

function readSeen(id: string) {
  try {
    return localStorage.getItem(seenKey(id)) === "done";
  } catch {
    return true; // storage blocked: never nag
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(seenKey(id), "done");
  } catch {
    /* private window – fine, it just runs again next time */
  }
}

/**
 * Guided tour for the admin: dims the page, lights up one piece at a time and
 * explains it. Mounted once in the admin layout; the steps come from the route.
 */
export function AdminTour() {
  const pathname = usePathname();
  const tour = useMemo(() => tourFor(pathname), [pathname]);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // The overlay is portalled to <body>: the admin header it sits in has `isolate`
  // and `overflow-hidden`, which would otherwise paint it beneath the page.
  useEffect(() => setMounted(true), []);

  // Offer the tour once per page, the first time this browser sees it.
  useEffect(() => {
    setRunning(false);
    setIndex(0);
    if (!tour) return;
    if (readSeen(tour.id)) return;
    const t = setTimeout(() => {
      // Mark it as offered as soon as it opens, so it never ambushes twice.
      markSeen(tour.id);
      setRunning(true);
    }, 600);
    return () => clearTimeout(t);
  }, [tour]);

  const steps = tour?.steps ?? [];
  const step: TourStep | undefined = steps[index];

  const finish = useCallback(() => {
    setRunning(false);
    setIndex(0);
    setBox(null);
    if (tour) markSeen(tour.id);
  }, [tour]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= steps.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Measure the target, following it through scrolling and resizing.
  useLayoutEffect(() => {
    if (!running || !step) return;
    if (!step.target) {
      setBox(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setBox(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    let frame = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    // Following for a moment covers the smooth scroll, then we stop the loop.
    const stop = setTimeout(() => cancelAnimationFrame(frame), 900);
    const onChange = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(stop);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [running, step, index]);

  // Skip a step whose element is not on this page.
  useEffect(() => {
    if (!running || !step?.target) return;
    if (document.querySelector(step.target)) return;
    const t = setTimeout(() => next(), 0);
    return () => clearTimeout(t);
  }, [running, step, next]);

  useEffect(() => {
    if (!running) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [running, next, back, finish]);

  useEffect(() => {
    if (running) cardRef.current?.focus();
  }, [running, index]);

  if (!tour) return null;

  return (
    <>
      <button
        type="button"
        // Clearing the box matters: without it the first step would be drawn at the
        // position the last step of the previous run left behind, then slide to the middle.
        onClick={() => { setBox(null); setIndex(0); setRunning(true); }}
        title={`${tour.label} — show me around this page`}
        aria-label={`${tour.label} — show me around this page`}
        className="relative grid size-10 place-items-center rounded-full bg-ivory-50/10 ring-1 ring-ivory-50/15 transition hover:bg-ivory-50/20"
      >
        <HelpCircle className="size-4" />
      </button>

      {running && step && mounted && createPortal(
        <div className="fixed inset-0 z-[200] print:hidden" role="dialog" aria-modal="true" aria-label={tour.label}>
          {/* The dim. The lit area is a hole punched with a very large ring shadow. */}
          <div
            aria-hidden="true"
            onClick={finish}
            className="absolute inset-0 motion-safe:animate-[tour-fade_0.25s_ease-out]"
            style={box ? undefined : { background: "rgba(7,23,13,0.62)" }}
          >
            {box && (
              <span
                className="absolute rounded-[18px] shadow-[0_0_0_9999px_rgba(7,23,13,0.62)] ring-2 ring-leaf-300/70 transition-all duration-[400ms] ease-[var(--ease-out-soft)]"
                style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
              />
            )}
          </div>

          <TourCard
            ref={cardRef}
            step={step}
            box={box}
            index={index}
            total={steps.length}
            onNext={next}
            onBack={back}
            onFinish={finish}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function TourCard({
  ref,
  step,
  box,
  index,
  total,
  onNext,
  onBack,
  onFinish,
}: {
  ref: React.Ref<HTMLDivElement>;
  step: TourStep;
  box: Box | null;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const last = index === total - 1;
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);

  // Measure the card so placement uses its real height, not a guess.
  useLayoutEffect(() => {
    const h = inner.current?.offsetHeight;
    if (h && h !== height) setHeight(h);
  }, [step, height]);

  const style = useMemo<React.CSSProperties>(() => {
    const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    const width = Math.min(CARD_W, vw - GAP * 2);
    // Centred in pixels, not with translate(-50%,-50%): the entrance animation also
    // drives `transform`, and a CSS animation outranks an inline style, so the card
    // would be drawn from its corner and then jump to the middle when it finished.
    const centred = { top: Math.max(GAP, (vh - height) / 2), left: Math.max(GAP, (vw - width) / 2), width };
    if (!box) return centred;

    const clamp = (v: number, max: number) => Math.min(Math.max(GAP, v), Math.max(GAP, max));
    const centredLeft = clamp(box.left + box.width / 2 - width / 2, vw - width - GAP);
    const centredTop = clamp(box.top + box.height / 2 - height / 2, vh - height - GAP);

    // Below, then above, then to the side — a tall target like the nav rail leaves
    // no room above or below, and the card must never cover what it points at.
    if (vh - (box.top + box.height) - GAP >= height) return { top: box.top + box.height + GAP, left: centredLeft, width };
    if (box.top - GAP >= height) return { top: box.top - height - GAP, left: centredLeft, width };
    if (vw - (box.left + box.width) - GAP >= width) return { top: centredTop, left: box.left + box.width + GAP, width };
    if (box.left - GAP >= width) return { top: centredTop, left: box.left - width - GAP, width };
    return centred;
  }, [box, height]);

  return (
    <div
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      tabIndex={-1}
      style={style}
      className="absolute overflow-hidden rounded-[22px] border border-cream-200 bg-white text-ink-900 shadow-[0_40px_90px_-40px_rgba(7,23,13,0.75)] outline-none transition-[top,left] duration-[400ms] ease-[var(--ease-out-soft)] motion-safe:animate-[tour-pop_0.28s_var(--ease-out-soft)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-cream-200 bg-botanical-100/45 px-5 py-3.5">
        <div>
          <p className="eyebrow flex items-center gap-2 text-[10px] text-green-600">
            <span className="h-px w-4 bg-green-600/50" /> Step {index + 1} of {total}
          </p>
          <h2 className="display mt-1.5 text-[1.3rem] leading-none text-forest-900">{step.title}</h2>
        </div>
        <button type="button" onClick={onFinish} aria-label="Close the tour" className="grid size-7 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-white hover:text-forest-800">
          <X className="size-4" />
        </button>
      </div>

      <p className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-700">{step.body}</p>

      <div className="flex items-center gap-1.5 px-5 pb-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-1 rounded-full transition-all duration-300", i === index ? "w-5 bg-forest-800" : i < index ? "w-1.5 bg-leaf-300" : "w-1.5 bg-cream-200")} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <button type="button" onClick={onFinish} className="text-xs text-ink-500 underline-offset-2 transition hover:text-danger-600 hover:underline">
          Skip the tour
        </button>
        <span className="flex gap-2">
          {index > 0 && (
            <button type="button" onClick={onBack} className="btn btn-outline btn-sm text-ink-700">Back</button>
          )}
          <button type="button" onClick={onNext} className="btn btn-primary px-5 py-2.5">
            {last ? "Done" : "Next"}
          </button>
        </span>
      </div>
    </div>
  );
}
