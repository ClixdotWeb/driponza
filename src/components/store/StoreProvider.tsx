"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CartView } from "@/server/cart";
import { addToCart, removeFromCart, setCartQuantity } from "@/server/actions/cart";
import { toggleWishlistAction } from "@/server/actions/account";

type Toast = { id: number; message: string; tone: "success" | "error" };

type StoreContext = {
  cart: CartView;
  cartOpen: boolean;
  pending: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (variantId: string, qty?: number, opts?: { openDrawer?: boolean }) => Promise<boolean>;
  setQty: (variantId: string, qty: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  wishlist: Set<string>;
  toggleWishlist: (productId: string) => Promise<void>;
  isLoggedIn: boolean;
  toast: (message: string, tone?: Toast["tone"]) => void;
};

const Ctx = createContext<StoreContext | null>(null);

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function StoreProvider({
  initialCart,
  initialWishlist,
  isLoggedIn,
  children,
}: {
  initialCart: CartView;
  initialWishlist: string[];
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState(() => new Set(initialWishlist));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, startTransition] = useTransition();
  const toastId = useRef(0);

  // Keep in sync when the server re-renders the layout (e.g. after login or checkout).
  const [lastInitial, setLastInitial] = useState(initialCart);
  if (initialCart !== lastInitial) {
    setLastInitial(initialCart);
    setCart(initialCart);
  }

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const add = useCallback<StoreContext["add"]>(
    async (variantId, qty = 1, opts) => {
      const res = await addToCart(variantId, qty);
      setCart(res.cart);
      if (!res.ok) {
        toast(res.error, "error");
        return false;
      }
      if (res.message) toast(res.message);
      if (opts?.openDrawer !== false) setCartOpen(true);
      startTransition(() => router.refresh());
      return true;
    },
    [router, toast],
  );

  const setQty = useCallback(
    async (variantId: string, qty: number) => {
      const res = await setCartQuantity(variantId, qty);
      setCart(res.cart);
      if (!res.ok) toast(res.error, "error");
      else if (res.message) toast(res.message);
      startTransition(() => router.refresh());
    },
    [router, toast],
  );

  const remove = useCallback(
    async (variantId: string) => {
      const res = await removeFromCart(variantId);
      setCart(res.cart);
      startTransition(() => router.refresh());
    },
    [router],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!isLoggedIn) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const res = await toggleWishlistAction(productId);
      if (res.needsLogin) return router.push("/login");
      if (!res.ok) return toast("Could not update your wishlist", "error");
      setWishlist((prev) => {
        const next = new Set(prev);
        if (res.inWishlist) next.add(productId);
        else next.delete(productId);
        return next;
      });
      toast(res.inWishlist ? "Saved to your wishlist" : "Removed from your wishlist");
    },
    [isLoggedIn, router, toast],
  );

  const value = useMemo<StoreContext>(
    () => ({
      cart,
      cartOpen,
      pending,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      add,
      setQty,
      remove,
      wishlist,
      toggleWishlist,
      isLoggedIn,
      toast,
    }),
    [cart, cartOpen, pending, add, setQty, remove, wishlist, toggleWishlist, isLoggedIn, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-full px-5 py-3 text-sm shadow-xl ${
              t.tone === "error" ? "bg-danger-600 text-white" : "bg-forest-900 text-ivory-50"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
