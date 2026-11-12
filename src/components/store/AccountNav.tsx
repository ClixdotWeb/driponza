"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

const LINKS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
];

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {LINKS.map((l) => {
        const active = l.href === "/account" ? path === "/account" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={cn("shrink-0 rounded-full px-4 py-2.5 text-sm transition", active ? "bg-forest-800 text-ivory-50" : "text-ink-700 hover:bg-cream-100")}>
            {l.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link href="/admin" className="shrink-0 rounded-full px-4 py-2.5 text-sm text-green-600 hover:bg-cream-100">
          Admin dashboard →
        </Link>
      )}
      <form action={logoutAction} className="shrink-0">
        <button className="rounded-full px-4 py-2.5 text-left text-sm text-ink-500 hover:bg-cream-100 hover:text-danger-600">Sign out</button>
      </form>
    </nav>
  );
}
