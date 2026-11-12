import Link from "next/link";
import { AdminHeader, Empty, Panel, Table } from "@/components/admin/ui";
import { SyncPaymentButton } from "@/components/admin/OrderForms";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { razorpayConfigured, webhookConfigured } from "@/lib/razorpay";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const statuses = ["CREATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
  const [payments, events] = await Promise.all([
    db.payment.findMany({
      where: status && statuses.includes(status) ? { status: status as never } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { order: { select: { id: true, number: true, customerName: true } } },
    }),
    db.paymentEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return (
    <>
      <AdminHeader title="Payments" description="Every Razorpay order and payment attempt. Use “Verify with Razorpay” to re-check a record against Razorpay's servers." />
      {!razorpayConfigured() && (
        <p className="mb-6 rounded-2xl border border-warning-500/40 bg-[#fbefd6] p-4 text-sm text-[#6b4700]">
          <strong>Awaiting credentials:</strong> set <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> in Coolify, then add the webhook <code>{process.env.APP_URL ?? "https://your-domain"}/api/webhooks/razorpay</code> in the Razorpay dashboard.
        </p>
      )}
      <form className="mb-4 flex gap-2">
        <select name="status" defaultValue={status ?? ""} className="field-input w-52 py-2">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline btn-sm text-forest-800">Filter</button>
      </form>
      {payments.length ? (
        <Table>
          <thead><tr><th>Date</th><th>Order</th><th>Razorpay IDs</th><th>Amount</th><th>Status</th><th>Verified</th><th /></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="text-ink-500">{formatDate(p.createdAt, true)}</td>
                <td><Link href={`/admin/orders/${p.order.id}`} className="text-green-600 hover:underline">{p.order.number}</Link><span className="block text-xs text-ink-500">{p.order.customerName}</span></td>
                <td className="break-all text-xs text-ink-500">{p.providerOrderId}<br />{p.providerPaymentId ?? "—"}</td>
                <td className="tabular-nums">{formatINR(p.amountPaise)}{p.refundedPaise > 0 && <span className="block text-xs text-ink-500">refunded {formatINR(p.refundedPaise)}</span>}</td>
                <td>{p.status}{p.errorDescription && <span className="block max-w-48 text-xs text-danger-600">{p.errorDescription}</span>}</td>
                <td className="text-xs">{p.signatureVerified ? "Signature ✓" : p.status === "CAPTURED" ? "Webhook / API ✓" : "—"}</td>
                <td>{razorpayConfigured() && p.status !== "CAPTURED" && <SyncPaymentButton paymentId={p.id} />}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No payments yet.</Empty>
      )}

      <Panel title={`Webhook events ${webhookConfigured() ? "" : "(webhook secret not configured)"}`} className="mt-8">
        {events.length ? (
          <ul className="divide-y divide-cream-100 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-4 py-2">
                <span className="font-medium">{e.type}</span>
                <span className="text-xs text-ink-500">{e.eventId}</span>
                <span className="text-xs text-ink-500">{formatDate(e.createdAt, true)}</span>
                <span className={e.processedAt ? "text-xs text-green-600" : "text-xs text-danger-600"}>{e.processedAt ? "processed" : e.error ?? "pending"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">No webhook events received yet.</p>
        )}
      </Panel>
    </>
  );
}
