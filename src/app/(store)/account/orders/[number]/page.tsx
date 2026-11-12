import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/store/OrderView";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { number } = await params;
  const { placed } = await searchParams;
  const user = await requireUser(`/account/orders/${number}`);
  const order = await db.order.findFirst({ where: { number, userId: user.id }, select: { id: true } });
  if (!order) notFound();
  return <OrderView orderId={order.id} placed={Boolean(placed)} />;
}
