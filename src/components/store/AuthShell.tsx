import { Cinnamon, StarAnise, Cardamom } from "@/components/spices/Spices";

export function AuthShell({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 px-2 pb-2 md:px-3 lg:grid-cols-2">
      <div className="hero-surface grain relative isolate hidden min-h-[640px] overflow-hidden rounded-[var(--radius-panel)] p-12 text-ivory-50 lg:flex lg:flex-col lg:justify-end">
        <Cinnamon uid="a1" className="pointer-events-none absolute -left-10 top-16 w-80 -rotate-[30deg] drop-shadow-2xl" />
        <StarAnise uid="a2" className="pointer-events-none absolute right-16 top-24 w-28 drop-shadow-2xl" />
        <Cardamom uid="a3" className="pointer-events-none absolute bottom-48 right-24 w-12 rotate-[25deg] drop-shadow-xl" />
        <p className="font-[family-name:var(--font-script)] text-3xl text-leaf-200">Nurture • Grow • Thrive</p>
        <p className="display mt-3 text-6xl">Pure Spices.<br /><em className="text-leaf-200">Bold Flavour.</em></p>
      </div>
      <div className="flex min-h-[70vh] items-center justify-center rounded-[var(--radius-panel)] bg-white px-5 py-14 md:px-12">
        <div className="w-full max-w-md">
          <h1 className="display text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
