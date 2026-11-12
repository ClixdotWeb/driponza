import Link from "next/link";
import { AdminHeader, Empty, Panel, PillTabs, Table, Tray } from "@/components/admin/ui";
import { CompleteRefundForm, TransferReviewForm } from "@/components/admin/OrderForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requirePermission("payments.verify");
  const { tab = "queue" } = await searchParams;
  const [queue, ledger, pendingRefunds, codDue, counts] = await Promise.all([
    db.bankTransferSubmission.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { createdAt: "asc" },
      include: { order: { select: { id: true, number: true, customerName: true, total: true, amountPaid: true, createdAt: true } } },
    }),
    tab === "ledger" ? db.paymentTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { order: { select: { id: true, number: true } } } }) : [],
    db.refund.findMany({ where: { status: "PENDING", orderId: { not: null } }, orderBy: { createdAt: "asc" }, include: { order: { select: { id: true, number: true, customerName: true } } } }),
    db.order.findMany({
      where: { paymentMethod: "COD", status: { in: ["DELIVERED", "OUT_FOR_DELIVERY", "SHIPPED"] }, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, number: true, customerName: true, total: true, amountPaid: true, status: true, deliveredAt: true },
    }),
    db.bankTransferSubmission.groupBy({ by: ["status"], _count: true }),
  ]);
  const canRefund = hasPermission(staff.permissions, "refunds.approve");
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <AdminHeader title="Payments" description="Verify bank transfers against your bank statement, track COD collections and record refunds. Nothing is marked paid automatically." />
      <PillTabs
        items={[
          { label: "To verify", count: queue.length, href: "/admin/payments", active: tab === "queue" },
          { label: "COD to collect", count: codDue.length, href: "/admin/payments?tab=cod", active: tab === "cod" },
          { label: "Refunds pending", count: pendingRefunds.length, href: "/admin/payments?tab=refunds", active: tab === "refunds" },
          { label: "Ledger", href: "/admin/payments?tab=ledger", active: tab === "ledger" },
        ]}
      />

      {tab === "queue" &&
        (queue.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.map((t) => {
              const due = toPaise(t.order.total) - toPaise(t.order.amountPaid);
              return (
                <Tray key={t.id}>
                  <div className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 text-sm">
                    <div>
                      <Link href={`/admin/orders/${t.order.id}`} className="font-medium text-green-600 hover:underline">{t.order.number}</Link>
                      <p className="text-ink-700">{t.order.customerName}</p>
                      <p className="mt-2 font-mono text-[13px]">UTR {t.reference}</p>
                      <p className="text-xs text-ink-500">
                        Claimed {formatINR(t.amountPaise)}{t.paidOn ? ` · paid ${formatDate(t.paidOn)}` : ""}{t.payerName ? ` · from ${t.payerName}` : ""} · submitted {formatDate(t.createdAt, true)}
                      </p>
                      {t.proofKey && <a href={`/api/media/private?key=${encodeURIComponent(t.proofKey)}`} target="_blank" className="text-xs text-green-600 underline">View screenshot</a>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-500">Due</p>
                      <p className="text-lg font-semibold tabular-nums">{formatINR(due)}</p>
                      {t.amountPaise !== due && <p className="text-[11px] text-[#8a5a00]">Claim differs from due</p>}
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl bg-white p-4">
                    <TransferReviewForm submissionId={t.id} suggestedRupees={paiseToDecimalString(Math.min(t.amountPaise, due))} />
                  </div>
                </Tray>
              );
            })}
          </div>
        ) : (
          <Empty>No transfers waiting. Verified so far: {n("VERIFIED")} · rejected: {n("REJECTED")}.</Empty>
        ))}

      {tab === "cod" &&
        (codDue.length ? (
          <Table>
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Delivered</th><th className="text-right">To collect</th></tr></thead>
            <tbody>
              {codDue.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-green-600 hover:underline">{o.number}</Link></td>
                  <td>{o.customerName}</td>
                  <td className="text-ink-500">{o.status.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="text-ink-500">{o.deliveredAt ? formatDate(o.deliveredAt) : "—"}</td>
                  <td className="text-right tabular-nums">{formatINR(toPaise(o.total) - toPaise(o.amountPaid))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>No cash-on-delivery amounts outstanding.</Empty>
        ))}

      {tab === "refunds" &&
        (pendingRefunds.length ? (
          <div className="grid gap-3">
            {pendingRefunds.map((r) => (
              <Panel key={r.id}>
                <p className="text-sm">
                  <Link href={`/admin/orders/${r.order!.id}`} className="font-medium text-green-600 hover:underline">{r.order!.number}</Link> · {r.order!.customerName} · {formatINR(r.amountPaise)} via {r.method ?? "—"} · approved {formatDate(r.createdAt, true)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
                {canRefund && <CompleteRefundForm refundId={r.id} orderId={r.order!.id} />}
              </Panel>
            ))}
          </div>
        ) : (
          <Empty>No approved refunds waiting to be sent.</Empty>
        ))}

      {tab === "ledger" &&
        (ledger.length ? (
          <Table>
            <thead><tr><th>Date</th><th>Order</th><th>Type</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {ledger.map((t) => (
                <tr key={t.id}>
                  <td className="text-ink-500">{formatDate(t.createdAt, true)}</td>
                  <td><Link href={`/admin/orders/${t.order.id}`} className="text-green-600 hover:underline">{t.order.number}</Link></td>
                  <td>{t.kind === "PAYMENT" ? "Payment verified" : t.kind === "COD_COLLECTION" ? "COD collected" : "Refund sent"}</td>
                  <td className="text-ink-500">{t.method.replace("_", " ").toLowerCase()}</td>
                  <td className="font-mono text-xs">{t.reference ?? "—"}</td>
                  <td className={`text-right tabular-nums ${t.kind === "REFUND" ? "text-danger-600" : "text-green-600"}`}>{t.kind === "REFUND" ? "−" : "+"}{formatINR(t.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>No money movements recorded yet.</Empty>
        ))}
    </>
  );
}
