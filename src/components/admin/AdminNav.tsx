"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/admin/nav-items";
import { cn } from "@/lib/utils";


/** Icon rail on desktop (labels as tooltips), scrollable pill row on mobile. Items are pre-filtered by permission on the server. */
export function AdminNav({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  const items = NAV.filter((i) => allowed.includes(i.href));
  return (
    <nav aria-label="Admin" className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:items-center lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible lg:px-0 lg:pb-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition lg:size-11 lg:justify-center lg:rounded-2xl lg:p-0",
              active ? "bg-leaf-300 text-forest-950" : "text-ivory-50/70 hover:bg-ivory-50/10 hover:text-ivory-50",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.8} />
            <span className="lg:sr-only">{label}</span>
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-forest-950 px-2.5 py-1.5 text-xs text-ivory-50 opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
