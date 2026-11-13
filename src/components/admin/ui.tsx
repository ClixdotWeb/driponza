import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow flex items-center gap-2.5 text-[10px] text-green-600">
          <span className="h-px w-6 bg-green-600/50" /> Driponza admin
        </p>
        <h1 className="display mt-2 text-[clamp(2.2rem,3.6vw,3.1rem)] leading-none text-forest-900">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-[22px] border border-cream-200 bg-white p-5 md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="display text-[1.55rem] leading-none text-forest-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A titled block inside a long form. The icon tile + display title + hairline
 * divider make each section readable at a glance while scrolling.
 */
export function FormSection({
  icon,
  step,
  title,
  description,
  actions,
  tone,
  children,
  className,
}: {
  icon?: React.ReactNode;
  step?: number;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tone?: "warn";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[22px] border bg-white", tone === "warn" ? "border-warning-500/40" : "border-cream-200", className)}>
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 md:px-6",
          tone === "warn" ? "border-warning-500/30 bg-[#fdf6e7]" : "border-cream-200 bg-botanical-100/45",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {(icon || step !== undefined) && (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl text-[13px] font-medium",
                tone === "warn" ? "bg-warning-500/20 text-[#6b4700]" : "bg-forest-800 text-ivory-50",
              )}
            >
              {icon ?? step}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="display text-[1.35rem] leading-none text-forest-900">{title}</h2>
            {description && <p className="mt-1.5 text-xs text-ink-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

/** Soft botanical surface (the reference's right-hand detail panel). */
export function Tray({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[22px] border border-botanical-100 bg-botanical-100/55 p-4 md:p-5 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-[1.4rem] [&_h2]:font-normal [&_h2]:text-forest-900", className)}>{children}</div>;
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href?: string; tone?: "warn" | "ok" }) {
  const body = (
    <div className={cn("group relative h-full overflow-hidden rounded-[22px] border bg-white p-5 transition", href && "hover:-translate-y-0.5 hover:border-leaf-300 hover:shadow-[0_18px_40px_-28px_rgba(18,61,34,0.5)]", tone === "warn" ? "border-warning-500/40 bg-[#fffaf0]" : "border-cream-200")}>
      <span aria-hidden="true" className={cn("absolute right-4 top-4 size-1.5 rounded-full", tone === "warn" ? "bg-warning-500" : "bg-leaf-300")} />
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="display mt-2 text-[2.3rem] leading-none tabular-nums text-forest-900">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Filter pills with count chips. */
export function PillTabs({ items }: { items: Array<{ label: string; href: string; count?: number; active: boolean }> }) {
  return (
    <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition",
            t.active ? "border-forest-800 bg-forest-800 font-medium text-ivory-50 shadow-[0_10px_24px_-14px_rgba(18,61,34,0.8)]" : "border-cream-200 bg-white text-ink-700 hover:border-forest-800",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", t.active ? "bg-leaf-300 text-forest-950" : "bg-cream-100 text-ink-500")}>{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[22px] border border-cream-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-ink-500 [&_thead]:border-b [&_thead]:border-cream-200 [&_thead]:bg-botanical-100/40 [&_tbody_tr]:border-b [&_tbody_tr]:border-cream-100 [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-ivory-50">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[22px] border border-dashed border-cream-200 bg-white/70 p-10 text-center text-sm text-ink-500">{children}</p>;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      {page > 1 && <Link className="btn btn-sm btn-outline text-forest-800" href={href(page - 1)}>Previous</Link>}
      <span className="text-ink-500">Page {page} of {pages}</span>
      {page < pages && <Link className="btn btn-sm btn-outline text-forest-800" href={href(page + 1)}>Next</Link>}
    </div>
  );
}

export function Denied({ permission }: { permission: string }) {
  return <Empty>Your role doesn&apos;t include “{permission}”. Ask a Super Admin for access.</Empty>;
}
