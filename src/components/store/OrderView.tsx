import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Landmark } from "lucide-react";
import { OrderActions } from "@/components/store/OrderActions";
import { TransferForm } from "@/components/store/TransferForm";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import { CUSTOMER_CAN_CANCEL, CUSTOMER_CAN_REQUEST_CANCEL } from "@/lib/order-status";
import { getSettings } from "@/lib/settings";
import { cn, formatDate, ORDER_STATUS_LABEL } from "@/lib/utils";

const TRACK = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const TRACK_INDEX: Record<string, number> = { CONFIRMED: 0, PROCESSING: 0, PACKED: 1, READY_TO_SHIP: 1, SHIPPED: 2, DELIVERY_FAILED: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };

/** Customer-facing order page – shared by signed-in customers and guests (secret link). */
export async function OrderView({ orderId, placed, guestKey }: { orderId: string; placed: boolean; guestKey?: string | null }) {
  const [order, settings] = await Promise.all([
    db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: true,
        shipment: { include: { events: { orderBy: { occurredAt: "desc" } } } },
        history: { orderBy: { createdAt: "asc" } },
        transfers: { orderBy: { createdAt: "desc" } },
        refunds: { orderBy: { createdAt: "desc" } },
      },
    }),
    getSettings(),
  ]);

  const total = toPaise(order.total);
  const paid = toPaise(order.amountPaid);
  const isBank = order.paymentMethod === "BANK_TRANSFER";
  const awaitingTransfer = isBank && ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION"].includes(order.status) && order.paymentStatus !== "PAID";
  const stepIndex = TRACK_INDEX[order.status] ?? -1;
  const cancellable =
    CUSTOMER_CAN_CANCEL.includes(order.status) || CUSTOMER_CAN_REQUEST_CANCEL.includes(order.status);
  const needsApproval = !CUSTOMER_CAN_CANCEL.includes(order.status) && !(order.paymentMethod === "COD" && ["CONFIRMED", "PROCESSING"].includes(order.status));
  const pendingSubmission = order.transfers.some((t) => t.status === "SUBMITTED");

  return (
    <div className="grid gap-6">
      {placed && (
        <div className="hero-surface grain relative overflow-hidden rounded-[22px] p-8 text-ivory-50">
          <CheckCircle2 className="size-8 text-leaf-300" />
          <p className="display mt-3 text-4xl">Thank you for your order!</p>
          <p className="mt-2 text-sm text-ivory-50/80">
            Order {order.number} has been received.{" "}
            {isBank ? "Please complete the bank transfer below – we confirm your order once the payment reaches our account." : "You'll pay in cash on delivery."}
          </p>
        </div>
      )}

      {awaitingTransfer && (
        <div className="card p-6 md:p-8">
          <h3 className="flex items-center gap-2 font-medium"><Landmark className="size-4 text-green-600" /> Pay by bank transfer</h3>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <dl className="grid gap-2 rounded-2xl bg-botanical-100/60 p-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-500">Amount</dt><dd className="font-semibold tabular-nums">{formatINR(total - paid)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-500">Reference</dt><dd className="font-mono">{order.number}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-500">Account name</dt><dd className="text-right">{settings.bank.accountName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-500">Account no.</dt><dd className="font-mono">{settings.bank.accountNumber}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-500">IFSC</dt><dd className="font-mono">{settings.bank.ifsc}</dd></div>
              {settings.bank.bankName && <div className="flex justify-between gap-4"><dt className="text-ink-500">Bank</dt><dd className="text-right">{settings.bank.bankName}{settings.bank.branch ? `, ${settings.bank.branch}` : ""}</dd></div>}
              {settings.bank.upiId && <div className="flex justify-between gap-4"><dt className="text-ink-500">UPI</dt><dd className="font-mono">{settings.bank.upiId}</dd></div>}
              {order.paymentDueAt && <p className="mt-2 text-xs text-ink-500">Please pay before {formatDate(order.paymentDueAt, true)} – unpaid orders are cancelled automatically after that.</p>}
              {settings.bank.instructions && <p className="mt-1 whitespace-pre-line text-xs text-ink-700">{settings.bank.instructions}</p>}
            </dl>
            <div>
              {pendingSubmission ? (
                <p className="rounded-2xl bg-[#fbefd6] p-4 text-sm text-[#8a5a00]">We have your payment details and are verifying them with our bank. You&apos;ll get an email once it&apos;s confirmed.</p>
              ) : (
                <TransferForm orderNumber={order.number} guestKey={guestKey ?? null} amountRupees={((total - paid) / 100).toFixed(2)} />
              )}
            </div>
          </div>
          {order.transfers.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t border-cream-200 pt-4 text-xs text-ink-700">
              {order.transfers.map((t) => (
                <li key={t.id}>
                  Ref {t.reference} · {formatINR(t.amountPaise)} ·{" "}
                  <span className={cn(t.status === "VERIFIED" ? "text-green-600" : t.status === "REJECTED" ? "text-danger-600" : "text-[#8a5a00]")}>
                    {t.status === "SUBMITTED" ? "being verified" : t.status === "VERIFIED" ? "verified" : `not matched${t.reviewNote ? ` – ${t.reviewNote}` : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-ink-500">Order</p>
            <h2 className="display text-4xl">{order.number}</h2>
            <p className="mt-1 text-sm text-ink-500">Placed {formatDate(order.createdAt, true)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        {stepIndex >= 0 && (
          <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Order progress">
            {TRACK.map((s, i) => (
              <li key={s} className="text-center">
                <div className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-green-600" : "bg-cream-200")} />
                <p className={cn("mt-2 text-[10px] sm:text-xs", i <= stepIndex ? "text-forest-800" : "text-ink-500")}>{ORDER_STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        )}

        {order.shipment && (order.shipment.trackingNumber || order.shipment.events.length > 0) && (
          <div className="mt-6 rounded-2xl bg-botanical-100 p-4 text-sm">
            {order.shipment.trackingNumber && (
              <>
                <p className="font-medium">Shipped with {order.shipment.carrier ?? "courier"}</p>
                <p className="text-ink-700">Tracking / AWB: {order.shipment.trackingNumber}</p>
                {order.shipment.trackingUrl && <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-green-600 underline">Track shipment</a>}
              </>
            )}
            {order.shipment.events.length > 0 && (
              <ol className="mt-3 space-y-1.5 text-xs text-ink-700">
                {order.shipment.events.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{ORDER_STATUS_LABEL[e.status as keyof typeof ORDER_STATUS_LABEL] ?? e.status}</span>
                    {e.location ? ` · ${e.location}` : ""} · {formatDate(e.occurredAt, true)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {order.refunds.length > 0 && (
          <ul className="mt-6 space-y-1.5 rounded-2xl bg-cream-100 p-4 text-sm">
            {order.refunds.map((r) => (
              <li key={r.id}>
                Refund {formatINR(r.amountPaise)} – {r.status === "PROCESSED" ? `sent ${r.processedAt ? formatDate(r.processedAt) : ""} (ref ${r.reference})` : r.status === "PENDING" ? "being processed" : "failed – we will contact you"}
              </li>
            ))}
          </ul>
        )}

        <OrderActions number={order.number} guestKey={guestKey ?? null} canCancel={cancellable} needsApproval={needsApproval} />
        {order.status === "DELIVERED" && order.userId && (
          <p className="mt-4 text-sm text-ink-700">
            Something wrong with your order? <Link href={`/account/orders/${order.number}/return`} className="text-green-600 underline">Request a return</Link>
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <h3 className="font-medium">Items</h3>
          <ul className="mt-4 divide-y divide-cream-200">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-4">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                  {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                </span>
                <div className="flex-1 text-sm">
                  {i.productSlug ? <Link href={`/products/${i.productSlug}`} className="font-medium hover:text-green-600">{i.productName}</Link> : <p className="font-medium">{i.productName}</p>}
                  <p className="text-ink-500">{i.variantLabel} · {formatINR(toPaise(i.unitPrice))} × {i.quantity}</p>
                </div>
                <p className="text-sm font-medium tabular-nums">{formatINR(toPaise(i.lineTotal))}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-cream-200 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-700">Subtotal</dt><dd className="tabular-nums">{formatINR(toPaise(order.subtotal))}</dd></div>
            {toPaise(order.discount) > 0 && <div className="flex justify-between text-green-600"><dt>Discount {order.couponCode && `(${order.couponCode})`}</dt><dd>−{formatINR(toPaise(order.discount))}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-700">Shipping</dt><dd className="tabular-nums">{formatINR(toPaise(order.shipping))}</dd></div>
            {toPaise(order.codCharge) > 0 && <div className="flex justify-between"><dt className="text-ink-700">COD charge</dt><dd className="tabular-nums">{formatINR(toPaise(order.codCharge))}</dd></div>}
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            {toPaise(order.taxTotal) > 0 && <p className="text-right text-xs text-ink-500">Includes {formatINR(toPaise(order.taxTotal))} GST</p>}
            {paid > 0 && <div className="flex justify-between text-green-600"><dt>Paid</dt><dd className="tabular-nums">{formatINR(paid)}</dd></div>}
          </dl>
          {order.invoiceNumber && (
            <a href={`/api/invoices/${order.number}${guestKey ? `?k=${encodeURIComponent(guestKey)}` : ""}`} className="btn btn-outline btn-sm mt-5 text-forest-800">Download invoice {order.invoiceNumber}</a>
          )}
        </div>
        <div className="grid h-fit gap-6">
          <div className="card p-6 text-sm">
            <h3 className="font-medium">Delivery address</h3>
            <p className="mt-3">{order.shipName}</p>
            <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, order.shipDistrict, order.shipState].filter(Boolean).join(", ")} – {order.shipPincode}</p>
            <p className="text-ink-500">{order.shipPhone}</p>
            {order.deliveryInstructions && <p className="mt-2 text-ink-500">Note: {order.deliveryInstructions}</p>}
            <p className="mt-3 text-ink-500">Payment: {order.paymentMethod === "COD" ? "Cash on delivery" : "Bank transfer"}</p>
          </div>
          <div className="card p-6 text-sm">
            <h3 className="font-medium">Timeline</h3>
            <ol className="mt-3 space-y-3 border-l border-cream-200 pl-4">
              {order.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.status]}</p>
                  <p className="text-xs text-ink-500">{formatDate(h.createdAt, true)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
