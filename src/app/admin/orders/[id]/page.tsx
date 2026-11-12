import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { AdminNoteForm, RefundForm, ShipmentForm, StatusForm, SyncPaymentButton } from "@/components/admin/OrderForms";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import { razorpayConfigured } from "@/lib/razorpay";
import { formatDate, ORDER_STATUS_LABEL } from "@/lib/utils";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      shipment: true,
      user: { select: { id: true, name: true, email: true } },
      history: { orderBy: { createdAt: "desc" }, include: { by: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" }, include: { refunds: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!order) notFound();

  const captured = order.payments.find((p) => p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED");
  const refundable = captured ? captured.amountPaise - captured.refundedPaise : 0;

  return (
    <>
      <AdminHeader
        title={order.number}
        description={`Placed ${formatDate(order.createdAt, true)} · ${order.paymentMethod === "COD" ? "Cash on delivery" : "Online payment"}`}
        actions={<div className="flex gap-2"><OrderStatusBadge status={order.status} /><PaymentStatusBadge status={order.paymentStatus} /></div>}
      />
      {order.status === "CANCEL_REQUESTED" && <p className="mb-4 rounded-xl bg-[#fbefd6] px-4 py-3 text-sm text-[#6b4700]">The customer requested cancellation. Use “Refund” below with “Cancel order” and “Restock” ticked to approve it.</p>}
      {order.stockIssue && <p className="mb-4 rounded-xl bg-danger-600/10 px-4 py-3 text-sm text-danger-600">Stock was insufficient when this order was paid. Restock and fulfil, or refund.</p>}
      {order.adminNote && <p className="mb-4 rounded-xl bg-cream-100 px-4 py-3 text-sm">Note: {order.adminNote}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-6">
          <Panel title="Items">
            <ul className="divide-y divide-cream-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-cream-100">{i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" />}</span>
                  <div className="flex-1">
                    <p className="font-medium">{i.productName}</p>
                    <p className="text-xs text-ink-500">{i.variantLabel} · SKU {i.sku}</p>
                  </div>
                  <p className="tabular-nums text-ink-700">{formatINR(toPaise(i.unitPrice))} × {i.quantity}</p>
                  <p className="w-24 text-right font-medium tabular-nums">{formatINR(toPaise(i.lineTotal))}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 ml-auto max-w-xs space-y-1.5 border-t border-cream-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{formatINR(toPaise(order.subtotal))}</dd></div>
              {toPaise(order.discount) > 0 && <div className="flex justify-between"><dt className="text-ink-500">Discount ({order.couponCode})</dt><dd className="tabular-nums">−{formatINR(toPaise(order.discount))}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-500">Shipping</dt><dd className="tabular-nums">{formatINR(toPaise(order.shipping))}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(toPaise(order.total))}</dd></div>
            </dl>
          </Panel>

          <Panel title="Payments">
            {order.payments.length ? (
              <ul className="grid gap-3 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="rounded-xl border border-cream-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{p.status} · {formatINR(p.amountPaise)}{p.method ? ` · ${p.method}` : ""}</p>
                      {razorpayConfigured() && <SyncPaymentButton paymentId={p.id} />}
                    </div>
                    <p className="mt-1 break-all text-xs text-ink-500">Razorpay order {p.providerOrderId}{p.providerPaymentId ? ` · payment ${p.providerPaymentId}` : ""}</p>
                    <p className="text-xs text-ink-500">Signature verified: {p.signatureVerified ? "yes" : "no (webhook/sync)"} · created {formatDate(p.createdAt, true)}{p.capturedAt ? ` · captured ${formatDate(p.capturedAt, true)}` : ""}</p>
                    {p.errorDescription && <p className="mt-1 text-xs text-danger-600">{p.errorCode} {p.errorDescription}</p>}
                    {p.refunds.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-cream-100 pt-2 text-xs">
                        {p.refunds.map((r) => <li key={r.id}>Refund {formatINR(r.amountPaise)} · {r.status} · {r.providerRefundId} {r.reason && `· ${r.reason}`}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">{order.paymentMethod === "COD" ? "Cash on delivery — payment is marked as received when the order is delivered." : "No payment attempts yet."}</p>
            )}
            {captured && refundable > 0 && (
              <div className="mt-5 border-t border-cream-100 pt-5">
                <h3 className="mb-3 text-sm font-medium">Refund</h3>
                <RefundForm orderId={order.id} maxPaise={refundable} />
              </div>
            )}
          </Panel>

          <Panel title="History">
            <ol className="space-y-3 border-l border-cream-200 pl-4 text-sm">
              {order.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.status]}</p>
                  <p className="text-xs text-ink-500">{formatDate(h.createdAt, true)}{h.by ? ` · ${h.by.name}` : ""}{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid h-fit gap-6">
          <Panel title="Update status"><StatusForm orderId={order.id} current={order.status} /></Panel>
          <Panel title="Shipping & tracking"><ShipmentForm orderId={order.id} shipment={order.shipment} /></Panel>
          <Panel title="Customer">
            <div className="text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-ink-700">{order.email}</p>
              <p className="text-ink-700">{order.phone}</p>
              {order.user && <Link href={`/admin/customers?q=${encodeURIComponent(order.user.email)}`} className="mt-1 inline-block text-xs text-green-600 underline">View customer</Link>}
              <h3 className="mt-4 text-xs font-medium uppercase tracking-wider text-ink-500">Ship to</h3>
              <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
              <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, order.shipDistrict, order.shipState].filter(Boolean).join(", ")} – {order.shipPincode}</p>
              {order.customerNote && <p className="mt-3 rounded-lg bg-cream-100 p-2 text-xs">Customer note: {order.customerNote}</p>}
            </div>
          </Panel>
          <Panel title="Internal note"><AdminNoteForm orderId={order.id} note={order.adminNote ?? ""} /></Panel>
        </div>
      </div>
    </>
  );
}
