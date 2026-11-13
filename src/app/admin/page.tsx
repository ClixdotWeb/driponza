import Link from "next/link";
import { IndianRupee, Layers, RefreshCw, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { istDayStart } from "@/server/reports";

export const metadata = { title: "Dashboard" };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const IST_MS = 5.5 * 3600_000;
const LIVE = { notIn: ["CANCELLED", "PAYMENT_FAILED"] } as { notIn: Array<"CANCELLED" | "PAYMENT_FAILED"> };

/** Bucket boundaries for the charts: hours for today, days for 7/30 days, months for all time. */
function buckets(range: RangeKey, now: Date, first: Date | null) {
  if (range === "today") {
    const start = istDayStart(now).getTime();
    return Array.from({ length: 24 }, (_, h) => ({ from: start + h * 3600_000, to: start + (h + 1) * 3600_000, label: h % 6 === 0 ? `${h}:00` : "" }));
  }
  if (range === "all") {
    const ist = new Date(now.getTime() + IST_MS);
    const firstIst = new Date((first ?? now).getTime() + IST_MS);
    const months = Math.min(24, Math.max(1, (ist.getUTCFullYear() - firstIst.getUTCFullYear()) * 12 + ist.getUTCMonth() - firstIst.getUTCMonth() + 1));
    return Array.from({ length: months }, (_, i) => {
      const y = ist.getUTCFullYear();
      const mo = ist.getUTCMonth() - (months - 1 - i);
      const from = Date.UTC(y, mo, 1) - IST_MS;
      const to = Date.UTC(y, mo + 1, 1) - IST_MS;
      return { from, to, label: new Date(from + IST_MS).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }) };
    });
  }
  const n = range === "7d" ? 7 : 30;
  return Array.from({ length: n }, (_, i) => {
    const from = istDayStart(now, i - (n - 1)).getTime();
    const label = n === 7 || i % 5 === 0 || i === n - 1 ? new Date(from + IST_MS).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
    return { from, to: from + 864e5, label };
  });
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; denied?: string }> }) {
  const staff = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === sp.range) ? (sp.range as RangeKey) : "30d";
  const financial = hasPermission(staff.permissions, "reports.financial");
  const now = new Date();
  const firstOrder = await db.order.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const from = range === "today" ? istDayStart(now) : range === "7d" ? istDayStart(now, -6) : range === "30d" ? istDayStart(now, -29) : (firstOrder?.createdAt ?? istDayStart(now));
  const inRange = { gte: from, lte: now };

  const [orders, signups, tx] = await Promise.all([
    db.order.findMany({ where: { createdAt: inRange, status: LIVE }, select: { createdAt: true, total: true } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: inRange } }),
    financial ? db.paymentTransaction.findMany({ where: { createdAt: inRange }, select: { createdAt: true, kind: true, amountPaise: true } }) : Promise.resolve([]),
  ]);

  const orderValue = orders.reduce((n, o) => n + toPaise(o.total), 0);
  const aov = orders.length ? Math.round(orderValue / orders.length) : 0;
  const slots = buckets(range, now, firstOrder?.createdAt ?? null);
  const salesSeries = slots.map((b) => ({ label: b.label, value: orders.filter((o) => o.createdAt.getTime() >= b.from && o.createdAt.getTime() < b.to).length }));
  const revenueSeries = slots.map((b) => ({
    label: b.label,
    value: tx.filter((t) => t.createdAt.getTime() >= b.from && t.createdAt.getTime() < b.to).reduce((n, t) => n + (t.kind === "REFUND" ? -t.amountPaise : t.amountPaise), 0),
  }));

  const cards = [
    { title: "Total revenue", value: financial ? formatINR(revenueSeries.reduce((n, s) => n + s.value, 0)) : "—", sub: "Verified payments − refunds", icon: TrendingUp, tone: "bg-forest-950 text-ivory-50", subTone: "text-ivory-50/70", href: "/admin/payments?tab=ledger" },
    { title: "Sales volume", value: String(orders.length), sub: "Orders placed (excl. cancelled)", icon: ShoppingBag, tone: "bg-gradient-to-br from-green-600 to-forest-700 text-ivory-50", subTone: "text-leaf-200", href: "/admin/orders" },
    { title: "Avg order value", value: formatINR(aov), sub: "Order value per checkout", icon: Layers, tone: "bg-gradient-to-br from-leaf-500 to-green-600 text-ivory-50", subTone: "text-ivory-50/80", href: "/admin/reports?r=monthly" },
    { title: "New sign-ups", value: String(signups), sub: "Registered accounts in range", icon: Users, tone: "bg-gradient-to-br from-[#c98a1c] to-spice-500 text-ivory-50", subTone: "text-ivory-50/85", href: "/admin/customers?tab=new" },
  ];

  return (
    <>
      {sp.denied && (
        <p className="mb-5 rounded-2xl bg-[#fbefd6] px-4 py-3 text-sm text-[#8a5a00]">Your role can&apos;t open that page ({PERMISSIONS[sp.denied as Permission] ?? sp.denied}).</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2.4rem,4vw,3.4rem)] leading-none text-forest-900">Store analytics</h1>
          <p className="mt-3 text-sm text-ink-500">Sales, customers and revenue – live from your store.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/admin?range=${range}`} className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2.5 text-[13px] font-medium text-forest-900 hover:border-forest-800">
            <RefreshCw className="size-3.5" /> Refresh data
          </Link>
          <nav aria-label="Date range" className="flex rounded-full border border-cream-200 bg-white p-1 text-[13px]">
            {RANGES.map((r) => (
              <Link key={r.key} href={`/admin?range=${r.key}`} aria-current={r.key === range ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 font-medium transition", r.key === range ? "bg-forest-900 text-ivory-50" : "text-ink-700 hover:text-forest-900")}>
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className={cn("group relative isolate overflow-hidden rounded-[22px] p-6 shadow-[0_20px_40px_-24px_rgba(7,23,13,0.55)] transition hover:-translate-y-0.5", c.tone)}>
            <c.icon aria-hidden="true" className="absolute -right-4 -top-4 -z-10 size-28 opacity-[0.12]" strokeWidth={1.4} />
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold">{c.title}</p>
              <c.icon className="size-[18px] opacity-90" />
            </div>
            <p className="display mt-4 text-[2.6rem] leading-none tabular-nums">{c.value}</p>
            <p className={cn("mt-3 text-[13px] font-medium", c.subTone)}>{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Sales volume" subtitle="Orders placed over time" legend="Orders" series={salesSeries} format={(v) => String(v)} />
        {financial ? (
          <ChartCard title="Revenue analytics" subtitle="Verified money received over time" legend="Net received" series={revenueSeries} format={(v) => formatINR(v)} />
        ) : (
          <section className="grid place-items-center rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-8 text-center text-sm text-ink-500">
            <IndianRupee className="size-6 text-green-600" />
            Revenue charts need the “financial reports” permission.
          </section>
        )}
      </div>
    </>
  );
}

function ChartCard({ title, subtitle, legend, series, format }: { title: string; subtitle: string; legend: string; series: Array<{ label: string; value: number }>; format: (v: number) => string }) {
  const W = 640;
  const H = 260;
  const pad = { top: 12, right: 8, bottom: 28, left: 64 };
  const max = Math.max(...series.map((s) => s.value), 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const slot = (W - pad.left - pad.right) / series.length;
  const barW = Math.max(4, Math.min(28, slot * 0.55));
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  const total = series.reduce((n, s) => n + s.value, 0);

  return (
    <section className="rounded-[var(--radius-panel)] border border-cream-200 bg-white/90 p-6 backdrop-blur md:p-8">
      <h2 className="display text-[2rem] leading-none text-forest-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
      <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-700">
        <span className="size-2.5 rounded-full bg-forest-800" /> {legend} <span className="ml-auto text-ink-500">Total {format(total)}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`${title}: total ${format(total)}`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#efebdf" />
            <text x={pad.left - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#69716a">{format(t)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const top = s.value > 0 ? Math.min(y(s.value), H - pad.bottom - 3) : H - pad.bottom;
          return (
            <g key={i}>
              <title>{`${s.label || ""} ${format(s.value)}`.trim()}</title>
              {s.value !== 0 && <rect x={x} y={top} width={barW} height={H - pad.bottom - top} rx={Math.min(barW / 2, 8)} fill={i === series.length - 1 ? "#2e7d3a" : "#123d22"} />}
              {s.label && <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#69716a">{s.label}</text>}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
