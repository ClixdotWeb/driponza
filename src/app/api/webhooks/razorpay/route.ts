import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, webhookConfigured } from "@/lib/razorpay";
import { markOrderPaid, markPaymentFailed, PaymentMismatchError, recordRefund } from "@/server/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Entity = Record<string, unknown> & { id: string };
type WebhookBody = {
  event: string;
  payload: {
    payment?: { entity: Entity & { order_id: string; amount: number; status: string; method?: string; error_code?: string; error_description?: string } };
    order?: { entity: Entity };
    refund?: { entity: Entity & { payment_id: string; amount: number; status: string } };
  };
};

export async function POST(req: Request) {
  if (!webhookConfigured()) return NextResponse.json({ error: "Webhook awaiting configuration" }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Razorpay retries deliveries; the event id makes processing idempotent.
  const eventId = req.headers.get("x-razorpay-event-id") ?? `${body.event}:${body.payload.payment?.entity.id ?? body.payload.refund?.entity.id ?? ""}`;
  const existing = await db.paymentEvent.findUnique({ where: { eventId } });
  if (existing?.processedAt) return NextResponse.json({ status: "duplicate" });
  const event = existing ?? (await db.paymentEvent.create({ data: { eventId, type: body.event, payload: body as object } }).catch(() => null));
  if (!event) return NextResponse.json({ status: "duplicate" }); // lost a race with a concurrent delivery

  try {
    const payment = body.payload.payment?.entity;
    switch (body.event) {
      case "payment.captured":
      case "order.paid":
        if (payment && payment.status === "captured") {
          const known = await db.payment.findUnique({ where: { providerOrderId: payment.order_id } });
          if (known) {
            await markOrderPaid({
              providerOrderId: payment.order_id,
              providerPaymentId: payment.id,
              amountPaise: Number(payment.amount),
              method: payment.method ?? null,
              source: "webhook",
            });
          }
        }
        break;
      case "payment.failed":
        if (payment) await markPaymentFailed(payment.order_id, payment.error_code, payment.error_description);
        break;
      case "refund.processed":
      case "refund.failed":
      case "refund.created": {
        const refund = body.payload.refund?.entity;
        if (refund) {
          const pay = await db.payment.findUnique({ where: { providerPaymentId: refund.payment_id } });
          if (pay) {
            await recordRefund({
              paymentId: pay.id,
              providerRefundId: refund.id,
              amountPaise: Number(refund.amount),
              status: body.event === "refund.failed" ? "FAILED" : body.event === "refund.processed" ? "PROCESSED" : "PENDING",
            });
          }
        }
        break;
      }
    }
    await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[razorpay:webhook]", err);
    if (err instanceof PaymentMismatchError) {
      // Recorded and flagged for an admin; acknowledge so Razorpay stops retrying.
      await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: err.message.slice(0, 1000) } });
      return NextResponse.json({ status: "flagged" });
    }
    await db.paymentEvent.update({ where: { id: event.id }, data: { error: String(err).slice(0, 1000) } });
    // 500 → Razorpay retries later; the event row is reused because processedAt is still null.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
