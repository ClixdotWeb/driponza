import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrderStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantity: true } } },
    take: 100,
  });

  if (!orders.length) {
    return (
      <div className="rounded-[22px] bg-cream-100 px-6 py-16 text-center">
        <p className="display text-3xl">No orders yet</p>
        <Link href="/shop" className="btn btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display mb-6 text-3xl">Order history</h2>
      <ul className="grid gap-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/account/orders/${o.number}`} className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-5 transition hover:border-sage-400">
              <div className="min-w-40">
                <p className="font-medium">{o.number}</p>
                <p className="text-xs text-ink-500">{formatDate(o.createdAt)}</p>
              </div>
              <OrderStatusBadge status={o.status} />
              <p className="text-sm text-ink-700">{o.items.reduce((n, i) => n + i.quantity, 0)} item(s)</p>
              <p className="ml-auto font-semibold tabular-nums">{formatINR(toPaise(o.total))}</p>
              <ChevronRight className="size-4 text-ink-500" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
