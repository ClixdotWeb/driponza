import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink-900 md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-[22px] border border-[#eceee9] bg-white p-5 md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Soft grey surface (the reference's right-hand detail panel). */
export function Tray({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[22px] bg-[#f4f5f2] p-4 md:p-5", className)}>{children}</div>;
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href?: string; tone?: "warn" | "ok" }) {
  const body = (
    <div className={cn("h-full rounded-[22px] border bg-white p-5 transition", href && "hover:border-sage-400", tone === "warn" ? "border-warning-500/50 bg-[#fffaf0]" : "border-[#eceee9]")}>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Filter pills with count chips; the active pill's chip is filled with the accent. */
export function PillTabs({ items }: { items: Array<{ label: string; href: string; count?: number; active: boolean }> }) {
  return (
    <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition",
            t.active ? "border-ink-900/10 bg-white font-medium text-ink-900 shadow-sm" : "border-[#eceee9] bg-white text-ink-500 hover:text-ink-900",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", t.active ? "bg-leaf-300 text-forest-950" : "border border-[#eceee9] text-ink-500")}>{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[22px] border border-[#eceee9] bg-white">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-ink-500 [&_thead]:border-b [&_thead]:border-[#eceee9] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#f2f3f0] [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-[#fafbf9]">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[22px] border border-dashed border-[#e2e5df] bg-white p-10 text-center text-sm text-ink-500">{children}</p>;
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
