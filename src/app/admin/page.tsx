import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronRight, Landmark, PackageCheck, RotateCcw, Truck, Wallet } from "lucide-react";
import { Table } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { BayLeaf, Cardamom, Cinnamon, Clove, StarAnise } from "@/components/spices/Spices";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { bankTransferReady, getSettings } from "@/lib/settings";
import { storageMode } from "@/lib/storage";
import { emailConfigured } from "@/lib/email";
import { cn, formatDate } from "@/lib/utils";
import { dashboardExtras, dashboardMetrics, istDayStart, monthlyRevenue } from "@/server/reports";

const RANGES = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 } as const;
const RANGE_LABEL: Record<string, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", "365d": "1 year" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; denied?: string }> }) {
  const staff = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const now = new Date();
  const days = RANGES[(sp.range as keyof typeof RANGES) ?? "30d"] ?? 30;
  const from = sp.from ? new Date(`${sp.from}T00:00:00+05:30`) : istDayStart(now, -(days - 1));
  const to = sp.to ? new Date(new Date(`${sp.to}T00:00:00+05:30`).getTime() + 864e5) : now;
  const financial = hasPermission(staff.permissions, "reports.financial");

  const [m, x, months, settings, zones, needsReview] = await Promise.all([
    dashboardMetrics({ from, to }),
    dashboardExtras({ from, to }),
    financial ? monthlyRevenue(12) : Promise.resolve([]),
    getSettings(),
    db.shippingZone.count({ where: { isActive: true } }),
    db.product.count({ where: { needsReview: true } }),
  ]);

  const istHour = Number(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  const greeting = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  const activeRange = sp.from || sp.to ? null : (sp.range ?? "30d");
  const toFulfil = m.orders.confirmed + m.orders.processing;

  const setup = [
    { ok: bankTransferReady(settings) || settings.commerce.codEnabled, label: "Turn on a payment method", href: "/admin/settings" },
    { ok: Boolean(settings.bank.accountNumber), label: "Add bank account details", href: "/admin/settings" },
    { ok: zones > 0 || settings.commerce.shippingConfigured, label: "Set shipping rates", href: "/admin/shipping" },
    { ok: m.outOfStock.length === 0, label: `Enter stock (${m.outOfStock.length} at zero)`, href: "/admin/inventory" },
    { ok: Boolean(settings.policies.returns && settings.policies.shipping && settings.policies.terms && settings.policies.privacy), label: "Publish store policies", href: "/admin/content" },
    { ok: emailConfigured(), label: "Connect email (SMTP)", href: null },
    { ok: storageMode() === "s3", label: "Connect Coolify image storage", href: null },
    { ok: needsReview === 0, label: "Review imported products", href: "/admin/products?review=1" },
  ];
  const done = setup.filter((s) => s.ok).length;

  const attention = [
    { n: m.pendingTransfers, label: "bank transfers to verify", href: "/admin/payments", icon: Landmark, perm: "payments.verify" },
    { n: x.attention.cancelRequests, label: "cancellation requests", href: "/admin/orders?tab=attention", icon: Ban, perm: "orders.update" },
    { n: x.attention.returnsToReview, label: "returns to review / inspect", href: "/admin/returns", icon: RotateCcw, perm: "returns.manage" },
    { n: x.attention.refundsPending, label: "refunds approved, not yet sent", href: "/admin/payments?tab=refunds", icon: Wallet, perm: "refunds.approve" },
    { n: x.attention.codDue, label: "delivered COD orders to reconcile", href: "/admin/payments?tab=cod", icon: Wallet, perm: "payments.verify" },
    { n: m.outOfStock.length, label: "variants out of stock", href: "/admin/inventory?filter=out", icon: AlertTriangle, perm: "inventory.view" },
  ].filter((a) => a.n > 0 && hasPermission(staff.permissions, a.perm as Permission));

  const pipeline = [
    { label: "Awaiting payment", n: m.orders.pending, href: "/admin/orders?tab=payment", icon: Landmark },
    { label: "To fulfil", n: toFulfil, href: "/admin/orders?tab=fulfil", icon: PackageCheck },
    { label: "In transit", n: m.orders.shipped, href: "/admin/orders?tab=transit", icon: Truck },
    { label: "Delivered", n: m.orders.delivered, href: "/admin/orders?tab=done", icon: CheckCircle2 },
  ];

  return (
    <>
      {sp.denied && (
        <p className="mb-5 rounded-2xl bg-[#fbefd6] px-4 py-3 text-sm text-[#8a5a00]">Your role can&apos;t open that page ({PERMISSIONS[sp.denied as Permission] ?? sp.denied}).</p>
      )}

      {/* ── Hero: greeting + money at a glance ── */}
      <section className="hero-surface grain relative isolate grid overflow-hidden rounded-[var(--radius-panel)] text-ivory-50 lg:grid-cols-[1.15fr_1fr]">
        <Cinnamon uid="dh1" className="pointer-events-none absolute -left-20 -bottom-10 w-64 -rotate-[18deg] opacity-80 drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)]" />
        <StarAnise uid="dh2" className="pointer-events-none absolute left-[44%] top-6 hidden w-14 drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)] lg:block" />
        <Cardamom uid="dh3" className="pointer-events-none absolute bottom-8 left-[40%] hidden w-7 rotate-[30deg] drop-shadow-xl lg:block" />
        <BayLeaf uid="dh4" className="pointer-events-none absolute -right-6 -top-8 w-28 rotate-[150deg] opacity-80 drop-shadow-xl" />

        <div className="relative px-6 pb-8 pt-8 md:px-10 md:pt-10 lg:pb-12">
          <p className="font-[family-name:var(--font-script)] text-2xl text-leaf-200">{greeting},</p>
          <h1 className="display mt-1 text-[clamp(2.6rem,4.6vw,3.8rem)] leading-none">{staff.name.split(" ")[0]}</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory-50/75">
            {attention.length ? `${attention.reduce((n, a) => n + a.n, 0)} thing(s) need your attention today.` : "Everything is up to date."} {toFulfil > 0 && `${toFulfil} order(s) are ready to pack.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {m.pendingTransfers > 0 && (
              <Link href="/admin/payments" className="btn btn-leaf px-5 py-2.5 text-[13px]">Verify {m.pendingTransfers} payment{m.pendingTransfers > 1 ? "s" : ""} <ArrowRight className="size-3.5" /></Link>
            )}
            <Link href="/admin/orders?tab=fulfil" className="btn border border-ivory-50/30 px-5 py-2.5 text-[13px] text-ivory-50 hover:bg-ivory-50 hover:text-forest-900">Fulfil orders</Link>
          </div>
        </div>

        {financial ? (
          <div className="relative m-3 rounded-[22px] bg-forest-950/45 p-6 ring-1 ring-ivory-50/10 backdrop-blur-sm md:m-4 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ivory-50/60">Received · last 30 days</p>
                <p className="display mt-2 text-[clamp(2.4rem,4vw,3.4rem)] leading-none text-leaf-200">{formatINR(m.revenue.month.net)}</p>
              </div>
              <Link href="/admin/reports" className="rounded-full bg-ivory-50/10 px-3 py-1.5 text-[11px] text-ivory-50/80 ring-1 ring-ivory-50/10 hover:text-ivory-50">Reports →</Link>
            </div>
            <Sparkline values={x.spark} />
            <dl className="mt-4 grid grid-cols-3 divide-x divide-ivory-50/10 text-sm">
              <div className="pr-3"><dt className="text-[11px] text-ivory-50/55">Today</dt><dd className="mt-1 font-medium">{formatINR(m.revenue.today.net)}</dd></div>
              <div className="px-3"><dt className="text-[11px] text-ivory-50/55">7 days</dt><dd className="mt-1 font-medium">{formatINR(m.revenue.week.net)}</dd></div>
              <div className="pl-3"><dt className="text-[11px] text-ivory-50/55">Refunded</dt><dd className="mt-1 font-medium">{formatINR(m.revenue.month.refunded)}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="relative m-4 grid place-items-center rounded-[22px] bg-forest-950/40 p-6 text-center ring-1 ring-ivory-50/10">
            <p className="display text-5xl text-leaf-200">{m.orders.total}</p>
            <p className="text-xs text-ivory-50/70">orders in the selected range</p>
          </div>
        )}
      </section>

      {/* ── Order pipeline ── */}
      <section className="mt-6 rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-5 backdrop-blur md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-[10px] text-green-600">Order flow</p>
            <h2 className="display mt-1 text-3xl leading-none text-forest-900">{m.orders.total} orders <span className="text-ink-500">in {activeRange ? RANGE_LABEL[activeRange] : "range"}</span></h2>
          </div>
          <form className="flex flex-wrap items-center gap-1.5 text-[12px]" action="/admin">
            {Object.keys(RANGES).map((r) => (
              <Link key={r} href={`/admin?range=${r}`} className={cn("rounded-full px-3 py-1.5 transition", activeRange === r ? "bg-forest-800 text-ivory-50" : "text-ink-700 hover:bg-cream-100")}>
                {RANGE_LABEL[r]}
              </Link>
            ))}
            <input type="date" name="from" defaultValue={sp.from} className="field-input w-auto py-1 text-[12px]" aria-label="From" />
            <input type="date" name="to" defaultValue={sp.to} className="field-input w-auto py-1 text-[12px]" aria-label="To" />
            <button className="rounded-full border border-forest-800 px-3 py-1 text-forest-800 hover:bg-forest-800 hover:text-ivory-50">Go</button>
          </form>
        </div>

        <ol className="relative mt-7 grid grid-cols-2 gap-y-6 md:grid-cols-4">
          <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-6 hidden border-t-2 border-dashed border-leaf-300/70 md:block" />
          {pipeline.map((p, i) => (
            <li key={p.label} className="relative text-center">
              <Link href={p.href} className="group inline-flex flex-col items-center">
                <span className={cn("relative grid size-12 place-items-center rounded-full ring-4 ring-white transition group-hover:scale-105", i === 1 && p.n > 0 ? "bg-forest-800 text-leaf-200" : "bg-botanical-100 text-forest-800")}>
                  <p.icon className="size-5" strokeWidth={1.8} />
                </span>
                <span className="display mt-3 text-[2.6rem] leading-none tabular-nums text-forest-900">{p.n}</span>
                <span className="mt-1 flex items-center gap-1 text-[13px] text-ink-700 group-hover:text-green-600">{p.label} <ChevronRight className="size-3.5" /></span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-cream-100 pt-4 text-[12px]">
          <span className="rounded-full bg-cream-100 px-3 py-1 text-ink-700">Cancelled · {m.orders.cancelled}</span>
          <span className={cn("rounded-full px-3 py-1", m.orders.attention ? "bg-[#fbefd6] text-[#8a5a00]" : "bg-cream-100 text-ink-700")}>Needs attention · {m.orders.attention}</span>
          <span className="rounded-full bg-cream-100 px-3 py-1 text-ink-700">New customers · {m.customers.new}</span>
          {m.methods.map((x2) => (
            <span key={x2.method} className="rounded-full bg-botanical-100 px-3 py-1 text-forest-800">{x2.method === "COD" ? "COD" : x2.method === "BANK_TRANSFER" ? "Bank transfer" : "Online"} · {x2.orders}</span>
          ))}
        </div>
      </section>

      {/* ── Revenue + action list ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {financial ? (
          <section className="rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-5 backdrop-blur md:p-7">
            <p className="eyebrow text-[10px] text-green-600">Revenue</p>
            <h2 className="display mt-1 text-3xl leading-none text-forest-900">Last 12 months</h2>
            <div className="mt-5"><RevenueChart rows={months} /></div>
          </section>
        ) : (
          <ListCard title="Best sellers" eyebrow="Products" items={x.best.map((b) => ({ id: b.id, image: b.image, title: b.name, sub: `${b.units} sold`, href: `/admin/products/${b.id}` }))} empty="No sales in this range yet." />
        )}

        <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-forest-900 p-5 text-ivory-50 md:p-7">
          <Clove uid="att1" className="pointer-events-none absolute -right-2 bottom-6 w-8 -rotate-12 opacity-40" />
          <p className="eyebrow text-[10px] text-leaf-300">To do</p>
          <h2 className="display mt-1 text-3xl leading-none">Needs your attention</h2>
          {attention.length ? (
            <ul className="mt-5 grid gap-2">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="group flex items-center gap-3 rounded-2xl bg-ivory-50/[0.06] p-3 ring-1 ring-ivory-50/10 transition hover:bg-ivory-50/[0.12]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-300 text-forest-950"><a.icon className="size-[18px]" strokeWidth={1.8} /></span>
                    <span className="flex-1 text-[13px] text-ivory-50/85"><span className="display mr-1.5 text-2xl leading-none text-ivory-50">{a.n}</span>{a.label}</span>
                    <ArrowRight className="size-4 text-ivory-50/50 transition group-hover:translate-x-0.5 group-hover:text-leaf-200" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 flex flex-col items-center py-6 text-center">
              <StarAnise uid="att2" className="w-14 drop-shadow-xl" />
              <p className="display mt-4 text-2xl text-leaf-200">All caught up</p>
              <p className="mt-1 text-xs text-ivory-50/60">No payments, returns or stock issues waiting.</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Products, stock, setup ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ListCard
          title="Best sellers"
          eyebrow={`Top products · ${activeRange ? RANGE_LABEL[activeRange] : "range"}`}
          items={x.best.map((b, i) => ({ id: b.id, image: b.image, title: b.name, sub: `${b.units} sold${financial ? ` · ${formatINR(b.revenuePaise)}` : ""}`, rank: i + 1, href: `/admin/products/${b.id}` }))}
          empty="No sales in this range yet."
        />
        <ListCard
          title="Stock alerts"
          eyebrow="Inventory"
          items={x.stockAlerts.map((s) => ({ id: s.id, image: s.image, title: s.name, sub: s.label, badge: s.stock <= 0 ? "Out" : `${s.stock} left`, danger: s.stock <= 0, href: `/admin/products/${s.productId}` }))}
          empty="Every variant is above its low-stock level."
          footer={{ label: "Open inventory", href: "/admin/inventory" }}
        />
        <section className="rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-5 backdrop-blur md:p-6">
          <div className="flex items-center gap-4">
            <ProgressRing done={done} total={setup.length} />
            <div>
              <p className="eyebrow text-[10px] text-green-600">Launch checklist</p>
              <h2 className="display mt-1 text-[1.7rem] leading-none text-forest-900">Store setup</h2>
              <p className="mt-1 text-xs text-ink-500">{done} of {setup.length} done</p>
            </div>
          </div>
          <ul className="mt-5 grid gap-1">
            {setup.map((s) => {
              const body = (
                <>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", s.ok ? "bg-green-600 text-white" : "border border-cream-200")}>{s.ok && <CheckCircle2 className="size-3.5" />}</span>
                  <span className={cn("flex-1", s.ok ? "text-ink-500 line-through decoration-cream-200" : "text-ink-900")}>{s.label}</span>
                  {!s.ok && s.href && <ChevronRight className="size-4 text-ink-500" />}
                  {!s.ok && !s.href && <span className="text-[10px] text-ink-500">hosting</span>}
                </>
              );
              return (
                <li key={s.label}>
                  {!s.ok && s.href ? (
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[13px] hover:bg-botanical-100/60">{body}</Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2 text-[13px]">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* ── Recent orders ── */}
      <section className="mt-6 rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-5 backdrop-blur md:p-7">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow text-[10px] text-green-600">Latest</p>
            <h2 className="display mt-1 text-3xl leading-none text-forest-900">Recent orders</h2>
          </div>
          <Link href="/admin/orders" className="text-sm text-green-600 hover:underline">All orders →</Link>
        </div>
        {m.recent.length ? (
          <Table>
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {m.recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-green-600 hover:underline">{o.number}</Link></td>
                  <td className="text-ink-500">{formatDate(o.createdAt, true)}</td>
                  <td>{o.customerName}</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td className="text-right tabular-nums">{formatINR(toPaise(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="flex flex-col items-center rounded-[22px] bg-botanical-100/50 py-10 text-center">
            <BayLeaf uid="ro1" className="w-16 rotate-[30deg] drop-shadow-lg" />
            <p className="display mt-3 text-2xl text-forest-900">No orders yet</p>
            <p className="mt-1 text-xs text-ink-500">They&apos;ll appear here as soon as customers check out.</p>
          </div>
        )}
      </section>
    </>
  );
}

/** 14-day net revenue trend (server-rendered SVG). */
function Sparkline({ values }: { values: number[] }) {
  const W = 320;
  const H = 70;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 6 - ((v - min) / (max - min || 1)) * (H - 12)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 h-[70px] w-full" role="img" aria-label="Net received per day over the last 14 days">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9fcf7e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#9fcf7e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#c3e3a9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#c3e3a9" />
    </svg>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" role="img" aria-label={`${done} of ${total} setup steps done`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e7f0e5" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="#2e7d3a" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} />
      <text x="32" y="32" transform="rotate(90 32 32)" textAnchor="middle" dominantBaseline="central" fontSize="15" fill="#123d22" fontFamily="var(--font-display)">{Math.round((done / total) * 100)}%</text>
    </svg>
  );
}

type Item = { id: string; image: string | null; title: string; sub: string; href: string; rank?: number; badge?: string; danger?: boolean };

function ListCard({ title, eyebrow, items, empty, footer }: { title: string; eyebrow: string; items: Item[]; empty: string; footer?: { label: string; href: string } }) {
  return (
    <section className="flex flex-col rounded-[var(--radius-panel)] border border-cream-200 bg-white/85 p-5 backdrop-blur md:p-6">
      <p className="eyebrow text-[10px] text-green-600">{eyebrow}</p>
      <h2 className="display mt-1 text-[1.7rem] leading-none text-forest-900">{title}</h2>
      {items.length ? (
        <ul className="mt-4 grid gap-1">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={it.href} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-botanical-100/60">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                  {it.image && <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />}
                  {it.rank && <span className="absolute left-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-forest-900 text-[10px] text-ivory-50">{it.rank}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{it.title}</span>
                  <span className="block text-xs text-ink-500">{it.sub}</span>
                </span>
                {it.badge && <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", it.danger ? "bg-danger-600/10 text-danger-600" : "bg-[#fbefd6] text-[#8a5a00]")}>{it.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl bg-botanical-100/50 p-5 text-center text-xs text-ink-500">{empty}</p>
      )}
      {footer && <Link href={footer.href} className="mt-auto pt-4 text-[13px] text-green-600 hover:underline">{footer.label} →</Link>}
    </section>
  );
}
