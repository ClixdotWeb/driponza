import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-4xl md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-cream-200 bg-white p-5 md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-medium">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href?: string; tone?: "warn" | "ok" }) {
  const body = (
    <div className={cn("h-full rounded-2xl border bg-white p-5 transition", href && "hover:border-sage-400", tone === "warn" ? "border-warning-500/50" : "border-cream-200")}>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="display mt-2 text-4xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-ink-500 [&_thead]:border-b [&_thead]:border-cream-200 [&_tbody_tr]:border-b [&_tbody_tr]:border-cream-100 [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-cream-200 bg-white p-10 text-center text-sm text-ink-500">{children}</p>;
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
