"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/admin/nav-items";
import { cn } from "@/lib/utils";

/**
 * Desktop: icon rail that expands (hover / keyboard focus) to show labels.
 * Mobile: horizontally scrollable pills. Items are pre-filtered by permission on the server.
 */
export function AdminNav({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  const items = NAV.filter((i) => allowed.includes(i.href));
  return (
    <nav aria-label="Admin" className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:pb-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-[13px] transition lg:h-11 lg:rounded-2xl lg:px-[13px] lg:py-0",
              active ? "bg-leaf-300 text-forest-950 shadow-[0_8px_20px_-8px_rgba(159,207,126,0.7)]" : "text-ivory-50/75 hover:bg-ivory-50/10 hover:text-ivory-50",
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
            <span className="whitespace-nowrap lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:opacity-100">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
