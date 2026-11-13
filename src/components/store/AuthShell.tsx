import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { BayLeaf, Cardamom, Cinnamon, Clove, Peppercorn, StarAnise } from "@/components/spices/Spices";
import { SpiceBackdrop } from "@/components/home/SpiceBackdrop";

/** Full-screen sign-in / register layout in the storefront's green spice style (no store header or footer). */
export function AuthShell({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel – a band on mobile, a full-height panel on desktop */}
      <aside className="hero-surface grain relative isolate overflow-hidden px-6 pb-10 pt-6 text-ivory-50 lg:m-3 lg:flex lg:flex-col lg:rounded-[var(--radius-panel)] lg:p-12">
        <Cinnamon uid="au1" className="pointer-events-none absolute -left-24 top-[30%] hidden w-72 -rotate-[30deg] drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)] lg:block" />
        <StarAnise uid="au2" className="pointer-events-none absolute -right-5 top-20 w-16 drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)] lg:right-16 lg:top-28 lg:w-32" />
        <Cardamom uid="au3" className="pointer-events-none absolute bottom-6 right-24 w-8 rotate-[25deg] drop-shadow-xl lg:bottom-56 lg:right-28 lg:w-12" />
        <BayLeaf uid="au4" className="pointer-events-none absolute -bottom-4 right-10 hidden w-28 rotate-[40deg] opacity-90 drop-shadow-xl lg:block" />
        <Clove uid="au5" className="pointer-events-none absolute left-[46%] top-[18%] hidden w-7 -rotate-12 opacity-80 blur-[1px] lg:block" />
        <Peppercorn uid="au6" className="pointer-events-none absolute bottom-[38%] left-[12%] hidden w-5 opacity-80 lg:block" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 hidden size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-leaf-200/15 lg:block" />

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center" aria-label="Driponza – home">
            <Image src="/brand/wordmark-ivory.png" alt="Driponza" width={825} height={149} className="h-7 w-auto lg:h-8" priority />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-ivory-50/25 px-3.5 py-1.5 text-xs text-ivory-50/85 transition hover:border-ivory-50 hover:text-ivory-50">
            <ArrowLeft className="size-3.5" /> Back to store
          </Link>
        </div>

        <div className="relative z-10 mt-8 lg:mt-auto">
          <p className="font-[family-name:var(--font-script)] text-2xl text-leaf-200 lg:text-3xl">Nurture • Grow • Thrive</p>
          <p className="display mt-2 text-[2.6rem] leading-[0.95] lg:mt-3 lg:text-[clamp(3.2rem,5vw,4.8rem)]">
            Pure Spices.
            <br />
            <em className="text-leaf-200">Bold Flavour.</em>
          </p>
          <p className="mt-4 hidden max-w-sm text-sm text-ivory-50/75 lg:block">Carefully selected whole spices from Kozhikode – rich aroma, authentic taste, thoughtfully packed.</p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative isolate flex items-center justify-center overflow-hidden px-5 py-12 md:px-12">
        <SpiceBackdrop
          mobile={false}
          items={[
            { kind: "leaf", className: "-right-10 top-10 w-28 rotate-[28deg] opacity-60", depth: 0.4 },
            { kind: "pepper", className: "bottom-16 left-8 w-6 opacity-50", depth: 0.6 },
          ]}
        />
        <div className="relative z-10 w-full max-w-md">
          <h1 className="display text-[clamp(2.6rem,5vw,3.4rem)] leading-none">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8 rounded-[22px] border border-cream-200 bg-white/90 p-6 shadow-[0_30px_60px_-40px_rgba(18,61,34,0.45)] backdrop-blur md:p-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
