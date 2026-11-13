import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHero } from "@/components/store/PageHero";
import { OrderStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { formatDate, ORDER_STATUS_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Track an order", robots: { index: false } };
export const dynamic = "force-dynamic";

const schema = z.object({
  number: z.string().trim().toUpperCase().regex(/^DZ-\d{6}-[A-Z0-9]{5}$/),
  email: z.string().trim().toLowerCase().email(),
  phone4: z.string().trim().regex(/^\d{4}$/),
});

/**
 * Guest order tracking. Needs order number + email + last 4 phone digits, is rate-limited,
 * and shows only status / courier tracking – never the address or other personal data.
 */
export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const submitted = Boolean(sp.number || sp.email || sp.phone4);
  let result: { error?: string; order?: Awaited<ReturnType<typeof find>> } = {};
  if (submitted) {
    const limited = await rateLimit("track", 15, 15 * 60_000);
    const parsed = schema.safeParse(sp);
    if (!limited.ok) result = { error: "Too many attempts – please try again in a few minutes." };
    else if (!parsed.success) result = { error: "Enter the order number (DZ-…), the email used and the last 4 digits of the phone number." };
    else {
      const order = await find(parsed.data.number);
      const ok = order && order.email === parsed.data.email && order.phone.replace(/\D/g, "").endsWith(parsed.data.phone4);
      result = ok ? { order } : { error: "We couldn't find an order with those details." };
    }
  }
  const o = result.order;

  return (
    <>
      <PageHero eyebrow="Orders" title={<>Track your <em className="text-leaf-200">order</em></>}>
        {user ? <>Signed in? See all your orders in <Link href="/account/orders" className="underline">My account</Link>.</> : "Enter your order details to see the latest status."}
      </PageHero>
      <section className="container-x grid gap-8 py-12 md:py-16 lg:grid-cols-[1fr_1.2fr]">
        <form className="card grid h-fit gap-4 p-6 md:p-8">
          <div>
            <label htmlFor="t-number" className="field-label">Order number</label>
            <input id="t-number" name="number" defaultValue={sp.number} placeholder="DZ-261113-ABCDE" className="field-input uppercase" required />
          </div>
          <div>
            <label htmlFor="t-email" className="field-label">Email used for the order</label>
            <input id="t-email" name="email" type="email" defaultValue={sp.email} className="field-input" required />
          </div>
          <div>
            <label htmlFor="t-phone" className="field-label">Last 4 digits of the phone number</label>
            <input id="t-phone" name="phone4" inputMode="numeric" maxLength={4} defaultValue={sp.phone4} className="field-input" required />
          </div>
          {result.error && <p role="alert" className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{result.error}</p>}
          <button className="btn btn-primary">Track order</button>
        </form>
        {o && (
          <div className="card p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-500">Order</p>
                <h2 className="display text-4xl">{o.number}</h2>
                <p className="text-sm text-ink-500">Placed {formatDate(o.createdAt, true)}</p>
              </div>
              <OrderStatusBadge status={o.status} />
            </div>
            {o.shipment?.trackingNumber && (
              <div className="mt-6 rounded-2xl bg-botanical-100 p-4 text-sm">
                <p className="font-medium">{o.shipment.carrier ?? "Courier"} · {o.shipment.trackingNumber}</p>
                {o.shipment.trackingUrl && <a href={o.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">Track with the courier</a>}
              </div>
            )}
            <ol className="mt-6 space-y-3 border-l border-cream-200 pl-4 text-sm">
              {[...(o.shipment?.events ?? []).map((e) => ({ id: e.id, label: ORDER_STATUS_LABEL[e.status as keyof typeof ORDER_STATUS_LABEL] ?? e.status, at: e.occurredAt, where: e.location })), ...o.history.map((h) => ({ id: h.id, label: ORDER_STATUS_LABEL[h.status], at: h.createdAt, where: null as string | null }))]
                .sort((a, b) => b.at.getTime() - a.at.getTime())
                .map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.label}{e.where ? ` · ${e.where}` : ""}</p>
                    <p className="text-xs text-ink-500">{formatDate(e.at, true)}</p>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </section>
    </>
  );
}

function find(number: string) {
  return db.order.findUnique({
    where: { number },
    select: {
      number: true, email: true, phone: true, status: true, createdAt: true,
      shipment: { select: { carrier: true, trackingNumber: true, trackingUrl: true, events: { orderBy: { occurredAt: "desc" } } } },
      history: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true } },
    },
  });
}
