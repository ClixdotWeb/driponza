import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, ReceiptText } from "lucide-react";
import { AdminHeader, Panel, Tray } from "@/components/admin/ui";
import {
  AdminNoteForm,
  CodForm,
  CompleteRefundForm,
  RefundForm,
  ShipmentEventForm,
  ShipmentForm,
  StatusForm,
  TransferReviewForm,
} from "@/components/admin/OrderForms";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS, REQUIRES_PAYMENT } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("orders.view");
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(staff.permissions, p);
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { batches: { include: { batch: { select: { batchNumber: true, bestBefore: true } } } } } },
      shipment: { include: { events: { orderBy: { occurredAt: "desc" } } } },
      user: { select: { id: true, name: true, email: true } },
      history: { orderBy: { createdAt: "desc" }, include: { by: { select: { name: true } } } },
      transfers: { orderBy: { createdAt: "desc" } },
      transactions: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
      returns: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, reason: true, createdAt: true } },
    },
  });
  if (!order) notFound();

  const total = toPaise(order.total);
  const paid = toPaise(order.amountPaid);
  const committedRefunds = order.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountPaise, 0);
  const refundable = paid - committedRefunds;
  // Hide fulfilment steps the server would reject anyway (unpaid bank transfer).
  const next = ORDER_TRANSITIONS[order.status].filter((s) => !(order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus !== "PAID" && REQUIRES_PAYMENT.includes(s)));

  return (
    <>
      <AdminHeader
        title={order.number}
        description={`Placed ${formatDate(order.createdAt, true)} · ${order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Online (legacy)"}${order.userId ? "" : " · Guest checkout"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <a href={`/admin/orders/${order.id}/packing-slip`} target="_blank" className="btn btn-sm btn-outline text-forest-800"><Printer className="size-3.5" /> Packing slip</a>
            {order.invoiceNumber && <a href={`/api/invoices/${order.number}`} className="btn btn-sm btn-outline text-forest-800"><ReceiptText className="size-3.5" /> Invoice</a>}
          </div>
        }
      />
      {order.status === "CANCEL_REQUESTED" && <p className="mb-4 rounded-2xl bg-[#fbefd6] px-4 py-3 text-sm text-[#6b4700]">The customer asked to cancel. Approve with “Cancelled” (stock returns automatically), or move it back to Confirmed/Processing to decline.</p>}
      {order.paymentStatus === "REFUND_PENDING" && <p className="mb-4 rounded-2xl bg-[#fbefd6] px-4 py-3 text-sm text-[#6b4700]">Money was received for this order but it is cancelled/returned – record the refund below.</p>}
      {order.adminNote && <p className="mb-4 rounded-2xl bg-[#f4f5f2] px-4 py-3 text-sm">Note: {order.adminNote}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="grid h-fit gap-6">
          <Panel title={`Items (${order.items.length})`}>
            <ul className="divide-y divide-[#f2f3f0]">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[#f4f5f2]">{i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.productName}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-ink-500">
                      <span className="rounded-full border border-[#e9ebe6] px-2 py-0.5">{i.variantLabel}</span>
                      <span className="rounded-full border border-[#e9ebe6] px-2 py-0.5">SKU {i.sku}</span>
                      {i.batches.map((b) => <span key={b.id} className="rounded-full bg-botanical-100 px-2 py-0.5 text-forest-800">Batch {b.batch.batchNumber} × {b.quantity}</span>)}
                    </p>
                  </div>
                  <p className="tabular-nums text-ink-700">{formatINR(toPaise(i.unitPrice))} × {i.quantity}</p>
                  <p className="w-24 text-right font-medium tabular-nums">{formatINR(toPaise(i.lineTotal))}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Shipment & tracking">
            {can("orders.update") ? (
              <div className="grid gap-6 md:grid-cols-2">
                <ShipmentForm orderId={order.id} shipment={order.shipment} />
                <div>
                  <ShipmentEventForm orderId={order.id} />
                  <ol className="mt-4 space-y-2 border-l border-[#e9ebe6] pl-4 text-xs">
                    {order.shipment?.events.map((e) => (
                      <li key={e.id}><span className="font-medium">{ORDER_STATUS_LABEL[e.status as keyof typeof ORDER_STATUS_LABEL] ?? e.status}</span>{e.location ? ` · ${e.location}` : ""} · {formatDate(e.occurredAt, true)}</li>
                    ))}
                    {!order.shipment?.events.length && <li className="text-ink-500">No tracking updates yet.</li>}
                  </ol>
                </div>
              </div>
            ) : (
              <p className="text-sm">{order.shipment?.carrier ?? "—"} {order.shipment?.trackingNumber ?? ""}</p>
            )}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-3 border-l border-[#e9ebe6] pl-4 text-sm">
              {order.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.status]}</p>
                  <p className="text-xs text-ink-500">{formatDate(h.createdAt, true)}{h.by ? ` · ${h.by.name}` : " · system"}{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid h-fit gap-4">
          {can("orders.update") && (
            <Tray>
              <h2 className="mb-3 text-[15px] font-semibold">Move order to</h2>
              <StatusForm orderId={order.id} next={next} />
              {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus !== "PAID" && ORDER_TRANSITIONS[order.status].some((s) => REQUIRES_PAYMENT.includes(s)) && (
                <p className="mt-3 text-xs text-[#8a5a00]">Fulfilment steps unlock once the bank transfer is verified.</p>
              )}
            </Tray>
          )}

          <Tray>
            <h2 className="mb-3 text-[15px] font-semibold">Payment</h2>
            <dl className="space-y-1.5 rounded-2xl bg-white p-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{formatINR(toPaise(order.subtotal))}</dd></div>
              {toPaise(order.discount) > 0 && <div className="flex justify-between"><dt className="text-ink-500">Discount ({order.couponCode})</dt><dd className="tabular-nums">−{formatINR(toPaise(order.discount))}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-500">Shipping</dt><dd className="tabular-nums">{formatINR(toPaise(order.shipping))}</dd></div>
              {toPaise(order.codCharge) > 0 && <div className="flex justify-between"><dt className="text-ink-500">COD charge</dt><dd className="tabular-nums">{formatINR(toPaise(order.codCharge))}</dd></div>}
              {toPaise(order.taxTotal) > 0 && <div className="flex justify-between text-xs"><dt className="text-ink-500">GST included</dt><dd className="tabular-nums">{formatINR(toPaise(order.taxTotal))}</dd></div>}
              <div className="flex justify-between border-t border-[#f0f1ee] pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
              <div className="flex justify-between text-green-600"><dt>Received</dt><dd className="tabular-nums">{formatINR(paid)}</dd></div>
              {committedRefunds > 0 && <div className="flex justify-between text-danger-600"><dt>Refunds</dt><dd className="tabular-nums">−{formatINR(committedRefunds)}</dd></div>}
            </dl>

            {order.transfers.length > 0 && (
              <ul className="mt-3 space-y-2">
                {order.transfers.map((t) => (
                  <li key={t.id} className="rounded-2xl bg-white p-4 text-sm">
                    <p className="font-medium">Transfer ref <span className="font-mono">{t.reference}</span> · {formatINR(t.amountPaise)}</p>
                    <p className="text-xs text-ink-500">
                      Submitted {formatDate(t.createdAt, true)}{t.paidOn ? ` · paid on ${formatDate(t.paidOn)}` : ""}{t.payerName ? ` · from ${t.payerName}` : ""}
                      {t.proofKey && can("payments.verify") && <> · <a href={`/api/media/private?key=${encodeURIComponent(t.proofKey)}`} target="_blank" className="text-green-600 underline">view screenshot</a></>}
                    </p>
                    {t.status === "SUBMITTED" ? (
                      can("payments.verify") ? <div className="mt-3"><TransferReviewForm submissionId={t.id} suggestedRupees={paiseToDecimalString(Math.min(t.amountPaise, total - paid))} /></div> : <p className="mt-1 text-xs text-[#8a5a00]">Awaiting verification</p>
                    ) : (
                      <p className={`mt-1 text-xs ${t.status === "VERIFIED" ? "text-green-600" : "text-danger-600"}`}>
                        {t.status === "VERIFIED" ? `Verified ${formatINR(t.verifiedAmountPaise ?? 0)}` : "Rejected"}{t.reviewedAt ? ` · ${formatDate(t.reviewedAt, true)}` : ""}{t.reviewNote ? ` · ${t.reviewNote}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {order.paymentMethod === "COD" && paid < total && can("payments.verify") && ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) && (
              <div className="mt-3 rounded-2xl bg-white p-4"><CodForm orderId={order.id} dueRupees={paiseToDecimalString(total - paid)} /></div>
            )}

            {order.transactions.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-2xl bg-white p-4 text-xs">
                {order.transactions.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <span>{t.kind === "REFUND" ? "Refund sent" : t.kind === "COD_COLLECTION" ? "COD collected" : "Payment verified"}{t.reference ? ` · ${t.reference}` : ""}</span>
                    <span className={`tabular-nums ${t.kind === "REFUND" ? "text-danger-600" : "text-green-600"}`}>{t.kind === "REFUND" ? "−" : "+"}{formatINR(t.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}

            {order.refunds.length > 0 && (
              <ul className="mt-3 space-y-2">
                {order.refunds.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-white p-4 text-xs">
                    Refund {formatINR(r.amountPaise)} · {r.method ?? "—"} · <span className={r.status === "PROCESSED" ? "text-green-600" : "text-[#8a5a00]"}>{r.status === "PROCESSED" ? `sent (ref ${r.reference})` : r.status.toLowerCase()}</span>
                    {r.reason ? ` · ${r.reason}` : ""}
                    {r.status === "PENDING" && can("refunds.approve") && <CompleteRefundForm refundId={r.id} orderId={order.id} />}
                  </li>
                ))}
              </ul>
            )}

            {refundable > 0 && can("refunds.approve") && (
              <div className="mt-3 rounded-2xl bg-white p-4">
                <h3 className="mb-2 text-sm font-medium">Record a refund</h3>
                <RefundForm orderId={order.id} maxRupees={paiseToDecimalString(refundable)} />
              </div>
            )}
          </Tray>

          <Tray>
            <h2 className="mb-3 text-[15px] font-semibold">Customer</h2>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-ink-700">{order.email}</p>
              <p className="text-ink-700">{order.phone}</p>
              {order.user && <Link href={`/admin/customers/${order.user.id}`} className="mt-1 inline-block text-xs text-green-600 underline">Customer profile</Link>}
              <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wider text-ink-500">Ship to</h3>
              <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
              <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, order.shipDistrict, order.shipState].filter(Boolean).join(", ")} – {order.shipPincode}</p>
              {order.deliveryInstructions && <p className="mt-2 rounded-xl bg-[#f4f5f2] p-2 text-xs">Delivery: {order.deliveryInstructions}</p>}
              {order.customerNote && <p className="mt-2 rounded-xl bg-[#f4f5f2] p-2 text-xs">Customer note: {order.customerNote}</p>}
            </div>
            {order.returns.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-2xl bg-white p-4 text-xs">
                {order.returns.map((r) => (
                  <li key={r.id}><Link href={`/admin/returns/${r.id}`} className="text-green-600 underline">Return request</Link> · {r.status.toLowerCase()} · {r.reason}</li>
                ))}
              </ul>
            )}
          </Tray>

          {can("orders.update") && (
            <Tray>
              <h2 className="mb-3 text-[15px] font-semibold">Internal note</h2>
              <AdminNoteForm orderId={order.id} note={order.adminNote ?? ""} />
            </Tray>
          )}
        </div>
      </div>
    </>
  );
}
