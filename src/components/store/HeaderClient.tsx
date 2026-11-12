"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Heart, Search, ShoppingBag, User, X, ArrowUpRight } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/auth";

type Category = { name: string; slug: string; count: number };

const iconBtn =
  "relative grid size-10 place-items-center rounded-full border border-cream-200 text-forest-800 transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-ivory-50";

export function NavDropdown({ label, categories }: { label: string; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="flex items-center gap-1 py-1 hover:text-forest-800" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`absolute left-1/2 top-full w-60 -translate-x-1/2 pt-3 transition-all duration-300 ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
        }`}
      >
        <div className="rounded-2xl border border-cream-200 bg-ivory-50 p-2 shadow-xl">
          <Link href="/shop" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-botanical-100">
            All products <ArrowUpRight className="size-3.5" />
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/shop?category=${c.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-botanical-100"
            >
              {c.name} <span className="text-xs text-ink-500">{c.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  return (
    <>
      <button type="button" className={iconBtn} aria-label="Search products" onClick={() => setOpen(true)}>
        <Search className="size-4" />
      </button>
      {/* Portalled: the header's backdrop-filter would otherwise trap position:fixed inside it */}
      {open && createPortal(
        <div className="fixed inset-0 z-[70] bg-forest-950/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form
            role="search"
            className="mx-auto mt-24 flex w-[min(640px,calc(100%-32px))] items-center gap-3 rounded-full bg-ivory-50 p-2 pl-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const q = input.current?.value.trim();
              setOpen(false);
              router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
            }}
          >
            <Search className="size-4 text-ink-500" />
            <input ref={input} name="q" placeholder="Search cardamom, cloves, pepper…" className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
            <button className="btn btn-primary btn-sm">Search</button>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}

export function HeaderActions({ user }: { user: SessionUser | null }) {
  const { cart, openCart } = useStore();
  return (
    <>
      <SearchButton />
      <Link href={user ? (user.role === "ADMIN" ? "/admin" : "/account") : "/login"} className={`${iconBtn} hidden sm:grid`} aria-label={user ? "Your account" : "Sign in"}>
        <User className="size-4" />
      </Link>
      <Link href="/wishlist" className={`${iconBtn} hidden sm:grid`} aria-label="Wishlist">
        <Heart className="size-4" />
      </Link>
      <button type="button" onClick={openCart} className={iconBtn} aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}>
        <ShoppingBag className="size-4" />
        {cart.count > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-green-600 px-1 text-[10px] font-semibold leading-5 text-ivory-50">
            {cart.count}
          </span>
        )}
      </button>
      <Link href="/shop" className="btn btn-primary btn-sm ml-1 hidden md:inline-flex">
        Shop now
      </Link>
    </>
  );
}

export function MobileMenu({ user, categories, links }: { user: SessionUser | null; categories: Category[]; links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open || prefersReducedMotion()) return;
      gsap.fromTo(panel.current, { clipPath: "inset(0 0 100% 0 round 28px)" }, { clipPath: "inset(0 0 0% 0 round 28px)", duration: 0.6, ease: "expo.out" });
      gsap.from("[data-menu-item]", { y: 24, opacity: 0, stagger: 0.05, duration: 0.5, delay: 0.15, ease: "power3.out" });
    },
    { dependencies: [open], scope: panel },
  );

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm ml-1" aria-expanded={open} aria-controls="mobile-menu">
        Menu
      </button>
      {open && createPortal(
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[80] p-2">
          <div ref={panel} className="hero-surface grain relative flex h-full flex-col overflow-y-auto rounded-[28px] p-6 text-ivory-50">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-leaf-200">Driponza</span>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full bg-ivory-50 text-forest-900" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} data-menu-item href={l.href} className="display py-1 text-5xl" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 flex flex-wrap gap-2" data-menu-item>
              {categories.map((c) => (
                <Link key={c.slug} href={`/shop?category=${c.slug}`} className="chip text-leaf-200" onClick={() => setOpen(false)}>
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="mt-auto grid gap-2 pt-10" data-menu-item>
              <Link href="/wishlist" className="btn btn-ivory w-full" onClick={() => setOpen(false)}>
                <Heart className="size-4" /> Wishlist
              </Link>
              {user ? (
                <>
                  <Link href={user.role === "ADMIN" ? "/admin" : "/account"} className="btn btn-leaf w-full" onClick={() => setOpen(false)}>
                    <User className="size-4" /> {user.role === "ADMIN" ? "Admin dashboard" : "My account"}
                  </Link>
                  <form action={logoutAction}>
                    <button className="btn w-full text-ivory-50/80">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn btn-leaf w-full" onClick={() => setOpen(false)}>
                  <User className="size-4" /> Sign in / Register
                </Link>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
