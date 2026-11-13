import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Panel, Stat, Table, Tray } from "@/components/admin/ui";
import { Cardamom, Cinnamon, StarAnise } from "@/components/spices/Spices";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { bankTransferReady, getSettings } from "@/lib/settings";
import { storageMode } from "@/lib/storage";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { dashboardMetrics, istDayStart, monthlyRevenue } from "@/server/reports";

const RANGES = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 } as const;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; denied?: string }> }) {
  const staff = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const now = new Date();
  const days = RANGES[(sp.range as keyof typeof RANGES) ?? "30d"] ?? 30;
  const from = sp.from ? new Date(`${sp.from}T00:00:00+05:30`) : istDayStart(now, -(days - 1));
  const to = sp.to ? new Date(new Date(`${sp.to}T00:00:00+05:30`).getTime() + 864e5) : now;
  const financial = hasPermission(staff.permissions, "reports.financial");

  const [m, months, settings, zones, needsReview] = await Promise.all([
    dashboardMetrics({ from, to }),
    financial ? monthlyRevenue(12) : Promise.resolve([]),
    getSettings(),
    db.shippingZone.count({ where: { isActive: true } }),
    db.product.count({ where: { needsReview: true } }),
  ]);

  const setup = [
    { ok: bankTransferReady(settings) || settings.commerce.codEnabled, label: "A payment method is enabled", hint: "Settings → Payments: add bank details and enable bank transfer and/or COD", href: "/admin/settings" },
    { ok: Boolean(settings.bank.accountNumber), label: "Bank account details", hint: "Needed for bank-transfer orders", href: "/admin/settings" },
    { ok: emailConfigured(), label: "Email (SMTP)", hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM – until then emails are logged, not sent" },
    { ok: storageMode() === "s3", label: `Image storage: ${storageMode() === "s3" ? "Coolify MinIO (S3)" : storageMode() === "blob" ? "Vercel Blob (fallback)" : storageMode()}`, hint: "Set the S3_* variables to move uploads to Coolify MinIO (see docs/ENVIRONMENT_SETUP.md)" },
    { ok: zones > 0 || settings.commerce.shippingConfigured, label: "Shipping rates", hint: "Shipping → add zones / rates", href: "/admin/shipping" },
    { ok: Boolean(settings.business.gstin) || false, label: "GSTIN for invoices", hint: "Settings → Business (leave empty if not GST-registered)", href: "/admin/settings" },
    { ok: Boolean(settings.policies.returns && settings.policies.shipping && settings.policies.terms && settings.policies.privacy), label: "Store policies", hint: "Content → policies (privacy, terms, shipping, returns)", href: "/admin/content" },
    { ok: needsReview === 0, label: "Imported products reviewed", hint: `${needsReview} product(s) flagged`, href: "/admin/products?review=1" },
    { ok: m.outOfStock.length === 0, label: "Stock entered", hint: `${m.outOfStock.length} variant(s) at zero stock`, href: "/admin/inventory" },
  ];

  const rangeLink = (r: string) => `/admin?range=${r}`;
  const activeRange = sp.from || sp.to ? null : (sp.range ?? "30d");
  const istHour = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  const greeting = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {/* Greeting banner in the storefront's hero style */}
      <section className="hero-surface grain relative isolate mb-6 overflow-hidden rounded-[var(--radius-panel)] px-6 py-8 text-ivory-50 md:px-10 md:py-10">
        <Cinnamon uid="dh1" className="pointer-events-none absolute -right-10 -top-6 w-56 rotate-[24deg] opacity-90 drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)] md:w-72" />
        <StarAnise uid="dh2" className="pointer-events-none absolute bottom-4 right-[30%] hidden w-16 drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)] md:block" />
        <Cardamom uid="dh3" className="pointer-events-none absolute right-[18%] top-[58%] hidden w-8 rotate-[30deg] drop-shadow-xl md:block" />
        <div className="relative max-w-xl">
          <p className="font-[family-name:var(--font-script)] text-2xl text-leaf-200">{greeting},</p>
          <h1 className="display mt-1 text-[clamp(2.4rem,4.5vw,3.6rem)] leading-none">{staff.name.split(" ")[0]}</h1>
          <p className="mt-3 text-sm text-ivory-50/75">
            {m.pendingTransfers > 0 ? `${m.pendingTransfers} bank transfer(s) waiting to be verified · ` : ""}
            {m.orders.confirmed + m.orders.processing} order(s) to fulfil · live numbers from your store.
          </p>
          {financial && (
            <p className="mt-5 inline-flex items-baseline gap-2 rounded-full bg-ivory-50/10 px-4 py-2 ring-1 ring-ivory-50/15">
              <span className="text-xs text-ivory-50/70">Received today</span>
              <span className="display text-2xl text-leaf-200">{formatINR(m.revenue.today.net)}</span>
            </p>
          )}
        </div>
      </section>

      <form className="mb-6 flex flex-wrap items-center gap-2 text-[13px]" action="/admin">
        <span className="mr-1 text-xs uppercase tracking-[0.14em] text-ink-500">Range</span>
        {Object.keys(RANGES).map((r) => (
          <Link key={r} href={rangeLink(r)} className={`rounded-full border px-3.5 py-1.5 ${activeRange === r ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200 bg-white text-ink-700 hover:border-forest-800"}`}>
            {r.replace("d", " days").replace("365 days", "1 year")}
          </Link>
        ))}
        <input type="date" name="from" defaultValue={sp.from} className="field-input w-auto py-1.5 text-[13px]" aria-label="From" />
        <input type="date" name="to" defaultValue={sp.to} className="field-input w-auto py-1.5 text-[13px]" aria-label="To" />
        <button className="btn btn-sm btn-outline text-forest-800">Apply</button>
      </form>

      {sp.denied && (
        <p className="mb-5 rounded-2xl bg-[#fbefd6] px-4 py-3 text-sm text-[#8a5a00]">
          Your role can&apos;t open that page ({PERMISSIONS[sp.denied as Permission] ?? sp.denied}).
        </p>
      )}

      {financial && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Received today" value={formatINR(m.revenue.today.net)} hint="Verified payments − refunds" />
          <Stat label="Last 7 days" value={formatINR(m.revenue.week.net)} />
          <Stat label="Last 30 days" value={formatINR(m.revenue.month.net)} />
          <Stat label="Selected range" value={formatINR(m.revenue.inRange.net)} hint={`${formatINR(m.revenue.inRange.refunded)} refunded`} href="/admin/reports" />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Orders" value={m.orders.total} href="/admin/orders" />
        <Stat label="Awaiting payment" value={m.orders.pending} href="/admin/orders?tab=payment" />
        <Stat label="Verify transfers" value={m.pendingTransfers} tone={m.pendingTransfers ? "warn" : undefined} href="/admin/payments" />
        <Stat label="To fulfil" value={m.orders.confirmed + m.orders.processing} href="/admin/orders?tab=fulfil" />
        <Stat label="In transit" value={m.orders.shipped} href="/admin/orders?tab=transit" />
        <Stat label="Delivered" value={m.orders.delivered} />
        <Stat label="Needs attention" value={m.orders.attention} tone={m.orders.attention ? "warn" : undefined} href="/admin/orders?tab=attention" />
        <Stat label="Cancelled" value={m.orders.cancelled} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {financial ? (
          <Panel title="Monthly net revenue">
            <RevenueChart rows={months} />
          </Panel>
        ) : (
          <Panel title="Best sellers">
            <BestSellers rows={m.best} />
          </Panel>
        )}
        <Tray>
          <h2 className="mb-4 text-[15px] font-semibold">Store setup</h2>
          <ul className="space-y-3 text-sm">
            {setup.map((s) => (
              <li key={s.label} className="flex gap-3 rounded-2xl bg-white p-3">
                {s.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-500" />}
                <div>
                  <p className={s.ok ? "text-ink-700" : "font-medium"}>{s.label}</p>
                  {!s.ok && (s.href ? <Link href={s.href} className="text-xs text-green-600 underline">{s.hint}</Link> : <p className="text-xs text-ink-500">{s.hint}</p>)}
                </div>
              </li>
            ))}
          </ul>
        </Tray>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Customers">
          <p className="text-[28px] font-semibold tabular-nums">{m.customers.total}</p>
          <p className="text-xs text-ink-500">{m.customers.new} new in range · {m.products} live products</p>
        </Panel>
        <Panel title="Payment methods (range)">
          {m.methods.length ? (
            <ul className="space-y-2 text-sm">
              {m.methods.map((x) => (
                <li key={x.method} className="flex justify-between">
                  <span>{x.method === "COD" ? "Cash on delivery" : x.method === "BANK_TRANSFER" ? "Bank transfer" : "Online (legacy)"}</span>
                  <span className="tabular-nums text-ink-700">{x.orders} · {financial ? formatINR(x.totalPaise) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No orders in this range.</p>
          )}
        </Panel>
        <Panel title="Inventory alerts" actions={<Link href="/admin/inventory" className="text-sm text-green-600">Inventory</Link>}>
          {m.outOfStock.length + m.lowStock.length === 0 ? (
            <p className="text-sm text-ink-500">All variants are above their low-stock level.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {[...m.outOfStock, ...m.lowStock].slice(0, 30).map((v) => (
                <li key={v.id} className="flex justify-between gap-3">
                  <span className="truncate">{v.product.name} · {v.label}</span>
                  <span className={v.stock <= 0 ? "text-danger-600" : "text-warning-500"}>{v.stock <= 0 ? "Out" : `${v.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {financial && (
        <div className="mt-6">
          <Panel title="Best sellers (range)"><BestSellers rows={m.best} /></Panel>
        </div>
      )}

      <div className="mt-6">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm text-green-600">View all</Link>}>
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
            <p className="text-sm text-ink-500">No orders yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function BestSellers({ rows }: { rows: Array<{ name: string; variant: string; units: number }> }) {
  if (!rows.length) return <p className="text-sm text-ink-500">No sales in this range.</p>;
  const max = Math.max(...rows.map((r) => r.units));
  return (
    <ul className="space-y-3 text-sm">
      {rows.map((r) => (
        <li key={r.name + r.variant}>
          <div className="flex justify-between"><span className="truncate">{r.name} · {r.variant}</span><span className="tabular-nums">{r.units}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-[#f0f2ee]"><div className="h-full rounded-full bg-leaf-300" style={{ width: `${(r.units / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
