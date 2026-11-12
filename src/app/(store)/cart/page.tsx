import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/CartPageClient";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const { contact, commerce } = await getSettings();
  return (
    <section className="container-x py-12 md:py-16">
      <h1 className="display text-[clamp(2.8rem,6vw,5rem)]">Your cart</h1>
      <CartPageClient whatsapp={contact.whatsapp} whatsappOrdering={commerce.whatsappOrdering} />
    </section>
  );
}
