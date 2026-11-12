import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/store/OrderView";
import { findAccessibleOrder } from "@/server/actions/checkout";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Guest order page: access needs the secret from the order email link (?k=…) or the cookie set at checkout. */
export default async function GuestOrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; k?: string }> }) {
  const { number } = await params;
  const { placed, k } = await searchParams;
  const order = await findAccessibleOrder(number, k ?? null);
  if (!order) notFound();
  return (
    <section className="container-x py-10 md:py-14">
      <OrderView orderId={order.id} placed={Boolean(placed)} guestKey={k ?? null} />
    </section>
  );
}
