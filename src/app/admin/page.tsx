import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminHeader, Panel, Stat, Table } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured, webhookConfigured } from "@/lib/razorpay";
import { storageMode } from "@/lib/storage";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { monthlyRevenue } from "@/server/reports";

export default async function AdminDashboard() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [months, ordersThisMonth, toFulfil, cancelRequests, onHold, customers, variants, needsReview, recent, settings] = await Promise.all([
    monthlyRevenue(12),
    db.order.count({ where: { createdAt: { gte: startOfMonth }, paymentStatus: { in: ["PAID", "NOT_REQUIRED", "PARTIALLY_REFUNDED"] } } }),
    db.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING"] } } }),
    db.order.count({ where: { status: "CANCEL_REQUESTED" } }),
    db.order.count({ where: { status: "ON_HOLD" } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.productVariant.findMany({ where: { isActive: true, product: { isActive: true } }, select: { stock: true, lowStockThreshold: true } }),
    db.product.count({ where: { needsReview: true } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    getSettings(),
  ]);
  const thisMonth = months[months.length - 1];
  const outOfStock = variants.filter((v) => v.stock <= 0).length;
  const lowStock = variants.filter((v) => v.stock > 0 && v.stock <= v.lowStockThreshold).length;

  const setup = [
    { ok: razorpayConfigured(), label: "Razorpay API keys", hint: process.env.VERCEL ? "Vercel → Project → Settings → Environment Variables: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET" : "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your hosting environment" },
    { ok: webhookConfigured(), label: "Razorpay webhook secret", hint: "Set RAZORPAY_WEBHOOK_SECRET and add the webhook in Razorpay" },
    { ok: emailConfigured(), label: "Email (SMTP)", hint: "Needed for password resets and order emails" },
    {
      ok: storageMode() !== "local" || (!process.env.VERCEL && Boolean(process.env.UPLOAD_DIR)),
      label: { blob: "Image storage: Vercel Blob", cloudinary: "Image storage: Cloudinary", local: "Image storage: local disk" }[storageMode()],
      hint: process.env.VERCEL ? "Connect a Blob store in Vercel → Storage to enable image uploads" : "Mount a persistent volume at UPLOAD_DIR or add Cloudinary keys",
    },
    { ok: settings.commerce.shippingConfigured, label: "Shipping charges confirmed", hint: "Content & settings → Shipping" },
    { ok: needsReview === 0, label: "Imported products reviewed", hint: `${needsReview} product(s) still flagged for review`, href: "/admin/products?review=1" },
    { ok: outOfStock === 0, label: "Stock entered", hint: `${outOfStock} variant(s) at zero stock`, href: "/admin/inventory" },
  ];

  return (
    <>
      <AdminHeader title="Dashboard" description="Sales, orders and store health at a glance." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Net revenue this month" value={formatINR(thisMonth.net)} hint={`${thisMonth.orders} paid order(s)`} href="/admin/reports" />
        <Stat label="Orders this month" value={ordersThisMonth} href="/admin/orders" />
        <Stat label="To fulfil" value={toFulfil} hint="Confirmed / processing" href="/admin/orders?status=CONFIRMED" />
        <Stat label="Needs attention" value={cancelRequests + onHold} hint={`${cancelRequests} cancel req · ${onHold} on hold`} tone={cancelRequests + onHold ? "warn" : undefined} href="/admin/orders?status=CANCEL_REQUESTED" />
        <Stat label="Stock alerts" value={outOfStock + lowStock} hint={`${outOfStock} out · ${lowStock} low`} tone={outOfStock + lowStock ? "warn" : undefined} href="/admin/inventory" />
        <Stat label="Customers" value={customers} href="/admin/customers" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Monthly revenue">
          <RevenueChart rows={months} />
        </Panel>
        <Panel title="Store setup">
          <ul className="space-y-3 text-sm">
            {setup.map((s) => (
              <li key={s.label} className="flex gap-3">
                {s.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-500" />}
                <div>
                  <p className={s.ok ? "text-ink-700" : "font-medium"}>{s.label}</p>
                  {!s.ok && (s.href ? <Link href={s.href} className="text-xs text-green-600 underline">{s.hint}</Link> : <p className="text-xs text-ink-500">{s.hint}</p>)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm text-green-600">View all</Link>}>
          {recent.length ? (
            <Table>
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {recent.map((o) => (
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
