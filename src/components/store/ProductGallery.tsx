"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const main = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(main.current!.querySelector("[data-img]"), { scale: 1.08, autoAlpha: 0.4 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: "expo.out" });
    },
    { dependencies: [index], scope: main },
  );

  if (!images.length) return <div className="aspect-square rounded-[var(--radius-panel)] bg-cream-100" />;
  const current = images[index] ?? images[0];

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto md:w-20 md:flex-col">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === index}
              className={cn("relative aspect-square w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition", i === index ? "border-green-600" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div ref={main} className="relative aspect-[4/5] flex-1 overflow-hidden rounded-[var(--radius-panel)] bg-cream-100">
        <div data-img className="absolute inset-0">
          <Image key={current.url} src={current.url} alt={current.alt || name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
    </div>
  );
}
