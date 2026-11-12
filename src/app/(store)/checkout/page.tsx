import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutClient } from "@/components/store/CheckoutClient";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/razorpay";
import { getCart } from "@/server/cart";
import { priceCart } from "@/server/orders";
import { INDIAN_STATES } from "@/server/validation";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCart();
  if (!cart.lines.length) redirect("/cart");

  const [addresses, settings, pricing] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    getSettings(),
    priceCart(cart, cart.couponCode, user.id),
  ]);

  return (
    <section className="container-x py-10 md:py-14">
      <h1 className="display text-[clamp(2.8rem,6vw,4.8rem)]">Checkout</h1>
      <CheckoutClient
        user={{ name: user.name, email: user.email, phone: user.phone }}
        cart={cart}
        initialPricing={pricing}
        initialCoupon={pricing.coupon?.code ?? null}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, district: a.district, state: a.state, pincode: a.pincode, isDefault: a.isDefault }))}
        states={[...INDIAN_STATES]}
        codEnabled={settings.commerce.codEnabled}
        razorpayReady={razorpayConfigured()}
        whatsapp={settings.contact.whatsapp}
      />
    </section>
  );
}
