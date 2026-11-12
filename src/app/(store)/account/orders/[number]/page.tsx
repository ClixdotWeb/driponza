import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { OrderActions } from "@/components/store/OrderActions";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatINR, toPaise } from "@/lib/money";
import { razorpayConfigured } from "@/lib/razorpay";
import { cn, formatDate, ORDER_STATUS_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

const TRACK = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; payment?: string }> }) {
  const { number } = await params;
  const { placed, payment } = await searchParams;
  const user = await requireUser(`/account/orders/${number}`);
  const order = await db.order.findFirst({
    where: { number, userId: user.id },
    include: { items: true, shipment: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const stepIndex = TRACK.indexOf(order.status as (typeof TRACK)[number]);
  const awaitingPayment = order.paymentMethod === "RAZORPAY" && ["PENDING", "FAILED"].includes(order.paymentStatus) && order.status !== "CANCELLED";
  const canCancel = ["PENDING_PAYMENT", "PAYMENT_FAILED", "CONFIRMED", "PROCESSING"].includes(order.status);

  return (
    <div className="grid gap-6">
      {placed && order.paymentStatus !== "PENDING" && order.paymentStatus !== "FAILED" && (
        <div className="hero-surface grain relative overflow-hidden rounded-[22px] p-8 text-ivory-50">
          <CheckCircle2 className="size-8 text-leaf-300" />
          <p className="display mt-3 text-4xl">Thank you for your order!</p>
          <p className="mt-2 text-sm text-ivory-50/80">Order {order.number} is confirmed. A confirmation has been sent to {order.email}.</p>
        </div>
      )}
      {(payment || (placed && awaitingPayment)) && awaitingPayment && (
        <p className="rounded-xl bg-[#fbefd6] px-4 py-3 text-sm text-[#8a5a00]">
          {payment && payment !== "incomplete" ? payment : "Payment for this order has not been completed yet."} If money was deducted, the order updates automatically once Razorpay confirms it.
        </p>
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
          <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Order progress">
            {TRACK.map((s, i) => (
              <li key={s} className="text-center">
                <div className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-green-600" : "bg-cream-200")} />
                <p className={cn("mt-2 text-[11px] sm:text-xs", i <= stepIndex ? "text-forest-800" : "text-ink-500")}>{ORDER_STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        )}

        {order.shipment?.trackingNumber && (
          <div className="mt-6 rounded-2xl bg-botanical-100 p-4 text-sm">
            <p className="font-medium">Shipped with {order.shipment.carrier ?? "courier"}</p>
            <p className="text-ink-700">Tracking number: {order.shipment.trackingNumber}</p>
            {order.shipment.trackingUrl && (
              <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-green-600 underline">Track shipment</a>
            )}
          </div>
        )}

        <OrderActions number={order.number} canPay={awaitingPayment && razorpayConfigured()} canCancel={canCancel} paid={order.paymentStatus === "PAID"} />
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
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(toPaise(order.total))}</dd></div>
          </dl>
        </div>
        <div className="grid h-fit gap-6">
          <div className="card p-6 text-sm">
            <h3 className="font-medium">Delivery address</h3>
            <p className="mt-3">{order.shipName}</p>
            <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, order.shipDistrict, order.shipState].filter(Boolean).join(", ")} – {order.shipPincode}</p>
            <p className="text-ink-500">{order.shipPhone}</p>
            <p className="mt-3 text-ink-500">Payment: {order.paymentMethod === "COD" ? "Cash on delivery" : "Online (Razorpay)"}</p>
          </div>
          <div className="card p-6 text-sm">
            <h3 className="font-medium">Timeline</h3>
            <ol className="mt-3 space-y-3 border-l border-cream-200 pl-4">
              {order.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.status]}</p>
                  <p className="text-xs text-ink-500">{formatDate(h.createdAt, true)}{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
