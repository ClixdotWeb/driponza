import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { CartDrawer } from "@/components/store/CartDrawer";
import { StoreProvider } from "@/components/store/StoreProvider";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { getCart } from "@/server/cart";
import { getStoreCategories } from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, cart, categories] = await Promise.all([getCurrentUser(), getSettings(), getCart(), getStoreCategories()]);
  const wishlist = user ? (await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } })).map((w) => w.productId) : [];

  return (
    <StoreProvider initialCart={cart} initialWishlist={wishlist} isLoggedIn={Boolean(user)}>
      <Header user={user} categories={categories} />
      <main id="main">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer whatsapp={settings.contact.whatsapp} whatsappOrdering={settings.commerce.whatsappOrdering} />
    </StoreProvider>
  );
}
