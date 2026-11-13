import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Ban, Check, IndianRupee, Landmark, Layers, PackageX, RefreshCw, RotateCcw, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import { BayLeaf, Cardamom, StarAnise } from "@/components/spices/Spices";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { bankTransferReady, getSettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
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

  const [orders, signups, tx, statusGroups, totalCustomers, topItems, variants, pendingTransfers, cancelRequests, returnsOpen, refundsPending, recent, settings, zones] = await Promise.all([
    db.order.findMany({ where: { createdAt: inRange, status: LIVE }, select: { createdAt: true, total: true, email: true, paymentMethod: true } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: inRange } }),
    financial ? db.paymentTransaction.findMany({ where: { createdAt: inRange }, select: { createdAt: true, kind: true, amountPaise: true } }) : Promise.resolve([]),
    db.order.groupBy({ by: ["status"], where: { createdAt: inRange }, _count: true }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { productId: { not: null }, order: { createdAt: inRange, status: { notIn: ["CANCELLED", "PAYMENT_FAILED", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PENDING"] } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      orderBy: { stock: "asc" },
      select: { id: true, label: true, stock: true, lowStockThreshold: true, product: { select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } },
    }),
    db.bankTransferSubmission.count({ where: { status: "SUBMITTED" } }),
    db.order.count({ where: { status: "CANCEL_REQUESTED" } }),
    db.returnRequest.count({ where: { status: { in: ["REQUESTED", "RECEIVED"] } } }),
    db.refund.count({ where: { status: "PENDING" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, number: true, customerName: true, createdAt: true, status: true, paymentStatus: true, total: true } }),
    getSettings(),
    db.shippingZone.count({ where: { isActive: true } }),
  ]);
  const topImages = await db.productImage.findMany({ where: { productId: { in: topItems.map((t) => t.productId!) } }, orderBy: { position: "asc" }, select: { productId: true, url: true } });

  const orderValue = orders.reduce((n, o) => n + toPaise(o.total), 0);
  const aov = orders.length ? Math.round(orderValue / orders.length) : 0;
  const slots = buckets(range, now, firstOrder?.createdAt ?? null);
  const salesSeries = slots.map((b) => ({ label: b.label, value: orders.filter((o) => o.createdAt.getTime() >= b.from && o.createdAt.getTime() < b.to).length }));
  const revenueSeries = slots.map((b) => ({
    label: b.label,
    value: tx.filter((t) => t.createdAt.getTime() >= b.from && t.createdAt.getTime() < b.to).reduce((n, t) => n + (t.kind === "REFUND" ? -t.amountPaise : t.amountPaise), 0),
  }));

  const cards = [
    { title: "Total revenue", value: financial ? formatINR(revenueSeries.reduce((n, s) => n + s.value, 0)) : "—", sub: "Verified payments − refunds", icon: TrendingUp, href: "/admin/payments?tab=ledger" },
    { title: "Sales volume", value: String(orders.length), sub: "Orders placed (excl. cancelled)", icon: ShoppingBag, href: "/admin/orders" },
    { title: "Avg order value", value: formatINR(aov), sub: "Order value per checkout", icon: Layers, href: "/admin/reports?r=monthly" },
    { title: "New sign-ups", value: String(signups), sub: "Registered accounts in range", icon: Users, href: "/admin/customers?tab=new" },
  ];

  // ── Details below the fold ──
  const count = (...s: string[]) => statusGroups.filter((g) => s.includes(g.status)).reduce((n, g) => n + g._count, 0);
  const stages = [
    { label: "Awaiting payment", n: count("PENDING", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "ON_HOLD"), color: "#c3e3a9", href: "/admin/orders?tab=payment" },
    { label: "To fulfil", n: count("CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP"), color: "#9fcf7e", href: "/admin/orders?tab=fulfil" },
    { label: "In transit", n: count("SHIPPED", "OUT_FOR_DELIVERY"), color: "#4c9a3f", href: "/admin/orders?tab=transit" },
    { label: "Delivered", n: count("DELIVERED", "RETURNED", "REFUNDED"), color: "#2e7d3a", href: "/admin/orders?tab=done" },
    { label: "Needs attention", n: count("CANCEL_REQUESTED", "RETURN_REQUESTED", "DELIVERY_FAILED", "RTO", "REFUND_PENDING"), color: "#c98a1c", href: "/admin/orders?tab=attention" },
    { label: "Cancelled", n: count("CANCELLED", "PAYMENT_FAILED"), color: "#cfc8b5", href: "/admin/orders?tab=cancelled" },
  ];
  const stageTotal = stages.reduce((n, s) => n + s.n, 0);
  const methods = (["BANK_TRANSFER", "COD"] as const).map((m) => {
    const list = orders.filter((o) => o.paymentMethod === m);
    return { key: m, label: m === "COD" ? "Cash on delivery" : "Bank transfer / UPI", n: list.length, value: list.reduce((a, o) => a + toPaise(o.total), 0) };
  });
  const buyers = new Set(orders.map((o) => o.email));
  const repeatBuyers = [...buyers].filter((e) => orders.filter((o) => o.email === e).length > 1).length;
  const top = topItems.map((t) => ({ id: t.productId!, name: t.productName, units: t._sum.quantity ?? 0, value: Math.round(Number(t._sum.lineTotal ?? 0) * 100), image: topImages.find((i) => i.productId === t.productId)?.url ?? null }));
  const topMax = Math.max(1, ...top.map((t) => t.units));
  const alerts = variants.filter((v) => v.stock <= v.lowStockThreshold).slice(0, 5);
  const attention = [
    { n: pendingTransfers, label: "Bank transfers to verify", href: "/admin/payments", icon: Landmark, perm: "payments.verify" },
    { n: cancelRequests, label: "Cancellation requests", href: "/admin/orders?tab=attention", icon: Ban, perm: "orders.update" },
    { n: returnsOpen, label: "Returns to review or inspect", href: "/admin/returns", icon: RotateCcw, perm: "returns.manage" },
    { n: refundsPending, label: "Refunds approved, not yet sent", href: "/admin/payments?tab=refunds", icon: Wallet, perm: "refunds.approve" },
    { n: variants.filter((v) => v.stock <= 0).length, label: "Variants out of stock", href: "/admin/inventory?filter=out", icon: PackageX, perm: "inventory.view" },
  ].filter((a) => hasPermission(staff.permissions, a.perm as Permission));
  const setup = [
    { ok: bankTransferReady(settings) || settings.commerce.codEnabled, label: "Payment method on", href: "/admin/settings" },
    { ok: Boolean(settings.bank.accountNumber), label: "Bank details", href: "/admin/settings" },
    { ok: zones > 0 || settings.commerce.shippingConfigured, label: "Shipping rates", href: "/admin/shipping" },
    { ok: variants.every((v) => v.stock > 0), label: "Stock entered", href: "/admin/inventory" },
    { ok: Boolean(settings.policies.returns && settings.policies.terms), label: "Policies", href: "/admin/content" },
    { ok: emailConfigured(), label: "Email (SMTP)", href: null },
  ];
  const setupDone = setup.filter((s) => s.ok).length;

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
          <nav aria-label="Date range" data-tour="range" className="flex rounded-full border border-cream-200 bg-white p-1 text-[13px]">
            {RANGES.map((r) => (
              <Link key={r.key} href={`/admin?range=${r.key}`} aria-current={r.key === range ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 font-medium transition", r.key === range ? "bg-forest-900 text-ivory-50" : "text-ink-700 hover:text-forest-900")}>
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div data-tour="kpis" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) =>
          i === 0 ? (
            <Link key={c.title} href={c.href} className="hero-surface grain group relative isolate overflow-hidden rounded-[22px] p-6 text-ivory-50 shadow-[0_24px_44px_-26px_rgba(7,23,13,0.7)] transition hover:-translate-y-0.5">
              <StarAnise uid="kpi1" className="pointer-events-none absolute -bottom-5 -right-4 -z-10 w-24 opacity-40" />
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold">{c.title}</p>
                <span className="grid size-9 place-items-center rounded-full bg-ivory-50/10 ring-1 ring-ivory-50/15"><c.icon className="size-4 text-leaf-200" /></span>
              </div>
              <p className="display mt-4 text-[2.6rem] leading-none tabular-nums text-leaf-200">{c.value}</p>
              <p className="mt-3 text-[13px] text-ivory-50/70">{c.sub}</p>
            </Link>
          ) : (
            <Link key={c.title} href={c.href} className="group relative isolate overflow-hidden rounded-[22px] border border-cream-200 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(18,61,34,0.45)] transition hover:-translate-y-0.5 hover:border-leaf-300">
              <BayLeaf uid={`kpi${i}`} className="pointer-events-none absolute -bottom-6 -right-5 -z-10 w-20 rotate-[35deg] opacity-[0.14]" />
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-ink-900">{c.title}</p>
                <span className="grid size-9 place-items-center rounded-full bg-botanical-100"><c.icon className="size-4 text-green-600" /></span>
              </div>
              <p className="display mt-4 text-[2.6rem] leading-none tabular-nums text-forest-900">{c.value}</p>
              <p className="mt-3 text-[13px] text-ink-500">{c.sub}</p>
            </Link>
          ),
        )}
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

      {/* ── Orders breakdown · payments · customers ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card eyebrow="Orders" title="Order status breakdown">
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-cream-100" role="img" aria-label="Orders by status">
            {stageTotal > 0 && stages.map((s) => s.n > 0 && <span key={s.label} style={{ width: `${(s.n / stageTotal) * 100}%`, background: s.color }} />)}
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {stages.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[13px] hover:bg-botanical-100/60">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-ink-700">{s.label}</span>
                  <span className="display text-xl tabular-nums text-forest-900">{s.n}</span>
                  <span className="w-10 text-right text-xs text-ink-500">{stageTotal ? Math.round((s.n / stageTotal) * 100) : 0}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid gap-6">
          <Card eyebrow="Payments" title="Payment methods">
            <ul className="mt-4 grid gap-3">
              {methods.map((m) => (
                <li key={m.key}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-ink-700">{m.label}</span>
                    <span className="text-ink-500"><span className="display text-xl text-forest-900">{m.n}</span> orders{financial ? ` · ${formatINR(m.value)}` : ""}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-cream-100"><div className="h-full rounded-full bg-green-600" style={{ width: `${orders.length ? (m.n / orders.length) * 100 : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>
          <Card eyebrow="Customers" title="Who is buying">
            <dl className="mt-4 grid grid-cols-3 divide-x divide-cream-200 text-center">
              <div><dt className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Buyers</dt><dd className="display mt-1 text-3xl text-forest-900">{buyers.size}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Repeat</dt><dd className="display mt-1 text-3xl text-forest-900">{repeatBuyers}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Accounts</dt><dd className="display mt-1 text-3xl text-forest-900">{totalCustomers}</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      {/* ── Products · stock · attention ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card eyebrow="Products" title="Top sellers">
          {top.length ? (
            <ul className="mt-4 grid gap-2">
              {top.map((t, i) => (
                <li key={t.id}>
                  <Link href={`/admin/products/${t.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-botanical-100/60">
                    <Thumb src={t.image} rank={i + 1} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{t.name}</span>
                      <span className="mt-1 block h-1.5 rounded-full bg-cream-100"><span className="block h-full rounded-full bg-leaf-500" style={{ width: `${(t.units / topMax) * 100}%` }} /></span>
                    </span>
                    <span className="w-14 text-right text-xs text-ink-500"><span className="display text-lg text-forest-900">{t.units}</span> sold</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No sales in this range yet.</EmptyNote>
          )}
        </Card>

        <Card eyebrow="Inventory" title="Stock alerts" footer={{ label: "Open inventory", href: "/admin/inventory" }}>
          {alerts.length ? (
            <ul className="mt-4 grid gap-2">
              {alerts.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/products/${v.product.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-botanical-100/60">
                    <Thumb src={v.product.images[0]?.url ?? null} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{v.product.name}</span><span className="text-xs text-ink-500">{v.label}</span></span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", v.stock <= 0 ? "bg-danger-600/10 text-danger-600" : "bg-[#fbefd6] text-[#8a5a00]")}>{v.stock <= 0 ? "Out" : `${v.stock} left`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>All variants are above their low-stock level.</EmptyNote>
          )}
        </Card>

        <Card eyebrow="To do" title="Needs attention">
          <ul className="mt-4 grid gap-1">
            {attention.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-botanical-100/60">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", a.n ? "bg-forest-900 text-leaf-200" : "bg-botanical-100 text-green-600")}><a.icon className="size-4" /></span>
                  <span className="flex-1 text-[13px] text-ink-700">{a.label}</span>
                  <span className={cn("display text-xl tabular-nums", a.n ? "text-forest-900" : "text-ink-500/60")}>{a.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── Recent orders · setup ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card eyebrow="Latest" title="Recent orders" footer={{ label: "All orders", href: "/admin/orders" }}>
          {recent.length ? (
            <ul className="mt-3 divide-y divide-cream-100">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-[13px] hover:bg-ivory-50">
                    <span className="w-36 font-medium text-green-600">{o.number}</span>
                    <span className="min-w-28 flex-1 text-ink-700">{o.customerName}</span>
                    <span className="text-xs text-ink-500">{formatDate(o.createdAt, true)}</span>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <span className="w-20 text-right font-medium tabular-nums">{formatINR(toPaise(o.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No orders yet – they appear here as soon as customers check out.</EmptyNote>
          )}
        </Card>

        <section className="hero-surface grain relative isolate overflow-hidden rounded-[var(--radius-panel)] p-6 text-ivory-50 md:p-7">
          <Cardamom uid="setup1" className="pointer-events-none absolute -right-2 bottom-6 -z-10 w-10 rotate-[30deg] opacity-60" />
          <p className="eyebrow text-[10px] text-leaf-300">Launch checklist</p>
          <h2 className="display mt-1 text-[1.9rem] leading-none">Store setup</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-ivory-50/15"><div className="h-full rounded-full bg-leaf-300" style={{ width: `${(setupDone / setup.length) * 100}%` }} /></div>
            <span className="text-xs text-ivory-50/75">{setupDone}/{setup.length}</span>
          </div>
          <ul className="mt-4 grid gap-1">
            {setup.map((s) => {
              const row = (
                <>
                  <span className={cn("grid size-5 place-items-center rounded-full", s.ok ? "bg-leaf-300 text-forest-950" : "ring-1 ring-ivory-50/30")}>{s.ok && <Check className="size-3" strokeWidth={3} />}</span>
                  <span className={cn("flex-1", s.ok && "text-ivory-50/55 line-through")}>{s.label}</span>
                  {!s.ok && s.href && <ArrowRight className="size-3.5 text-ivory-50/60" />}
                </>
              );
              return (
                <li key={s.label}>
                  {!s.ok && s.href ? (
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13px] hover:bg-ivory-50/10">{row}</Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-1.5 text-[13px]">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

function Card({ eyebrow, title, children, footer }: { eyebrow: string; title: string; children: React.ReactNode; footer?: { label: string; href: string } }) {
  return (
    <section className="flex flex-col rounded-[var(--radius-panel)] border border-cream-200 bg-white/90 p-6 backdrop-blur md:p-7">
      <p className="eyebrow text-[10px] text-green-600">{eyebrow}</p>
      <h2 className="display mt-1 text-[1.9rem] leading-none text-forest-900">{title}</h2>
      {children}
      {footer && <Link href={footer.href} className="mt-auto pt-4 text-[13px] text-green-600 hover:underline">{footer.label} →</Link>}
    </section>
  );
}

function Thumb({ src, rank }: { src: string | null; rank?: number }) {
  return (
    <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-cream-100">
      {src && <Image src={src} alt="" fill sizes="44px" className="object-cover" />}
      {rank && <span className="absolute left-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-forest-900 text-[9px] text-ivory-50">{rank}</span>}
    </span>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 rounded-2xl bg-botanical-100/50 p-5 text-center text-xs text-ink-500">{children}</p>;
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
      {series.every((s) => s.value === 0) ? (
        <div className="mt-4 grid aspect-[640/260] place-items-center rounded-2xl bg-botanical-100/40 text-center">
          <div>
            <StarAnise uid={`empty-${title}`} className="mx-auto w-12 opacity-70" />
            <p className="display mt-2 text-xl text-forest-900">No data in this range</p>
            <p className="text-xs text-ink-500">Try “All time”, or check back after the first orders.</p>
          </div>
        </div>
      ) : (
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
      )}
    </section>
  );
}
