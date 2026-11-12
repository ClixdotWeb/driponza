import { StarAnise, Cardamom, BayLeaf } from "@/components/spices/Spices";

/** Compact version of the home hero panel used at the top of inner pages. */
export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="px-2 pb-2 md:px-3">
      <div className="hero-surface grain relative isolate overflow-hidden rounded-[var(--radius-panel)] px-6 py-16 text-center text-ivory-50 md:py-24">
        <StarAnise uid="ph1" className="pointer-events-none absolute -left-6 -top-6 w-24 opacity-90 drop-shadow-2xl md:left-[8%] md:top-6 md:w-28" />
        <BayLeaf uid="ph2" className="pointer-events-none absolute -bottom-12 -right-4 w-20 rotate-[40deg] drop-shadow-2xl md:right-[8%] md:w-24" />
        <Cardamom uid="ph3" className="pointer-events-none absolute bottom-6 left-[14%] hidden w-9 -rotate-[30deg] drop-shadow-xl md:block" />
        <div className="relative z-10 mx-auto max-w-3xl">
          {eyebrow && <p className="eyebrow text-leaf-200">{eyebrow}</p>}
          <h1 className="display mt-4 text-[clamp(2.8rem,7vw,5.5rem)]">{title}</h1>
          {children && <div className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ivory-50/80">{children}</div>}
        </div>
      </div>
    </section>
  );
}
