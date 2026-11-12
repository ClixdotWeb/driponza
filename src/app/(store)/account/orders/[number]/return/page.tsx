import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnForm } from "@/components/store/ReturnForm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Request a return", robots: { index: false } };

export default async function ReturnRequestPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser(`/account/orders/${number}/return`);
  const [order, settings] = await Promise.all([
    db.order.findFirst({ where: { number, userId: user.id }, include: { items: true, returns: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    getSettings(),
  ]);
  if (!order) notFound();
  const open = order.returns[0] && !["REJECTED", "CLOSED"].includes(order.returns[0].status);

  return (
    <div className="card p-6 md:p-8">
      <Link href={`/account/orders/${order.number}`} className="text-sm text-green-600">← Back to order</Link>
      <h2 className="display mt-3 text-4xl">Request a return</h2>
      <p className="mt-2 text-sm text-ink-500">
        Order {order.number}.{" "}
        {settings.policies.returns ? <Link href="/policies/returns" className="underline">Read our return policy</Link> : "We review every request individually."}
      </p>
      <div className="mt-6 max-w-xl">
        {open ? (
          <p className="rounded-2xl bg-botanical-100 p-4 text-sm">Your return request is {order.returns[0].status.toLowerCase()}. We&apos;ll email you with updates.</p>
        ) : order.status !== "DELIVERED" ? (
          <p className="rounded-2xl bg-cream-100 p-4 text-sm">Returns can be requested once the order has been delivered.</p>
        ) : (
          <ReturnForm orderNumber={order.number} items={order.items.map((i) => ({ id: i.id, name: i.productName, variant: i.variantLabel, quantity: i.quantity }))} />
        )}
      </div>
    </div>
  );
}
