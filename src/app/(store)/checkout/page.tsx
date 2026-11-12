import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutClient } from "@/components/store/CheckoutClient";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getCart } from "@/server/cart";
import { quoteCart } from "@/server/orders";
import { INDIAN_STATES } from "@/server/validation";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await getCurrentUser(); // guests may check out
  const cart = await getCart();
  if (!cart.lines.length) redirect("/cart");

  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : [];
  const first = addresses[0];
  const [settings, quote] = await Promise.all([
    getSettings(),
    quoteCart({ cart, couponCode: cart.couponCode, pincode: first?.pincode ?? null, state: first?.state ?? null, method: null, userId: user?.id ?? null, email: user?.email ?? null }),
  ]);

  return (
    <section className="container-x py-10 md:py-14">
      <h1 className="display text-[clamp(2.8rem,6vw,4.8rem)]">Checkout</h1>
      <CheckoutClient
        user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
        cart={cart}
        initialQuote={quote}
        initialCoupon={quote.coupon?.code ?? null}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, district: a.district, state: a.state, pincode: a.pincode, isDefault: a.isDefault }))}
        states={[...INDIAN_STATES]}
        whatsapp={settings.contact.whatsapp}
      />
    </section>
  );
}
