import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Bell, ExternalLink, LogOut, Settings, Store } from "lucide-react";
import { SpiceBackdrop } from "@/components/home/SpiceBackdrop";
import { AdminNav } from "@/components/admin/AdminNav";
import { NAV } from "@/components/admin/nav-items";
import { Cardamom, Clove, StarAnise } from "@/components/spices/Spices";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { maybeExpireUnpaidOrders } from "@/server/orders";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Driponza Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side staff check on every admin request (the proxy only checks that a cookie exists).
  const staff = await requireStaff();
  await maybeExpireUnpaidOrders();
  const allowed = NAV.filter((i) => hasPermission(staff.permissions, i.perm as Permission)).map((i) => i.href);
  const canVerify = hasPermission(staff.permissions, "payments.verify");
  const pending = canVerify ? await db.bankTransferSubmission.count({ where: { status: "SUBMITTED" } }) : 0;
  const initials = staff.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-svh bg-ivory-50 lg:flex lg:gap-3 lg:p-3">
      {/* Rail: expands on hover/focus and pushes the canvas (the canvas shrinks – nothing is covered). */}
      <div className="group/rail relative z-40 print:hidden lg:w-[76px] lg:shrink-0 lg:transition-[width] lg:duration-300 lg:ease-[var(--ease-out-soft)] lg:hover:w-[244px] lg:focus-within:w-[244px]">
        <aside className="hero-surface grain relative isolate overflow-hidden text-ivory-50 lg:sticky lg:top-3 lg:flex lg:h-[calc(100svh-1.5rem)] lg:w-full lg:flex-col lg:rounded-[28px] lg:py-5 lg:shadow-[0_30px_60px_-30px_rgba(7,23,13,0.6)]">
          <StarAnise uid="rail1" className="pointer-events-none absolute -bottom-6 -right-8 hidden w-28 opacity-25 lg:block" />
          <Cardamom uid="rail2" className="pointer-events-none absolute bottom-32 -left-3 hidden w-8 rotate-[30deg] opacity-30 lg:block" />
          <div className="relative flex items-center justify-between px-4 py-3 lg:mb-4 lg:block lg:px-[16px] lg:py-0">
            <Link href="/admin" className="flex items-center gap-3" title="Driponza admin">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ivory-50/10 ring-1 ring-ivory-50/10">
                <Image src="/brand/mark-ivory.png" alt="" width={28} height={28} className="h-6 w-auto" />
              </span>
              <span className="leading-tight lg:opacity-0 lg:transition-opacity lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:opacity-100">
                <span className="display block text-[1.5rem] leading-none text-ivory-50">Driponza</span>
                <span className="mt-0.5 block font-[family-name:var(--font-script)] text-sm text-leaf-200">Admin</span>
              </span>
            </Link>
            <form action={logoutAction} className="lg:hidden">
              <button className="text-xs text-ivory-50/70">Sign out</button>
            </form>
          </div>
          <span className="mx-[22px] mb-3 hidden h-px bg-ivory-50/15 lg:block" />
          <div className="relative lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <AdminNav allowed={allowed} />
          </div>
          <form action={logoutAction} className="relative mt-3 hidden px-3 lg:block">
            <button className="flex h-11 w-full items-center gap-3 rounded-2xl px-[13px] text-[13px] text-[#f4a497] transition hover:bg-ivory-50/10">
              <LogOut className="size-[18px] shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">Sign out</span>
            </button>
          </form>
        </aside>
      </div>

      {/* Canvas */}
      <div className="relative isolate min-w-0 flex-1 lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-cream-200 lg:bg-[#fbfaf5]">
        {/* Floating spices behind the content (desktop), same style as the storefront sections */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
          <SpiceBackdrop
            mobile={false}
            items={[
              { kind: "leaf", className: "-right-10 top-[22%] w-32 rotate-[28deg] opacity-[0.55]", depth: 0.5 },
              { kind: "star", className: "right-[6%] top-[62%] w-16 opacity-[0.35]", depth: 0.8 },
              { kind: "cardamom", className: "left-[38%] top-[48%] w-7 rotate-[40deg] opacity-[0.3]", depth: 0.6 },
              { kind: "cinnamon", className: "-left-24 bottom-[8%] w-72 -rotate-[24deg] opacity-[0.28]", depth: 0.3 },
              { kind: "pepper", className: "right-[30%] bottom-[12%] w-5 opacity-[0.35]", depth: 0.9 },
              { kind: "clove", className: "left-[62%] top-[14%] w-6 -rotate-12 opacity-[0.3]", depth: 0.7 },
            ]}
          />
        </div>
        <header className="hero-surface grain relative isolate flex items-center justify-end gap-2 overflow-hidden px-4 py-3 text-ivory-50 print:hidden md:px-8">
          <Clove uid="top1" className="pointer-events-none absolute left-[38%] top-1 hidden w-6 -rotate-[25deg] opacity-40 md:block" />
          <StarAnise uid="top2" className="pointer-events-none absolute -top-4 left-[58%] hidden w-14 opacity-30 md:block" />
          <Link href="/" target="_blank" className="relative mr-auto inline-flex items-center gap-2 rounded-full bg-ivory-50/10 px-4 py-2 text-[13px] font-medium ring-1 ring-ivory-50/15 transition hover:bg-ivory-50 hover:text-forest-900">
            <Store className="size-4" /> Open website <ExternalLink className="size-3 opacity-70" />
          </Link>
          {canVerify && (
            <Link href="/admin/payments" title="Payments awaiting verification" className="relative grid size-10 place-items-center rounded-full bg-ivory-50/10 ring-1 ring-ivory-50/15 hover:bg-ivory-50/20">
              <Bell className="size-4" />
              {pending > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-leaf-300 px-1 text-[10px] font-semibold text-forest-950">{pending}</span>}
            </Link>
          )}
          {allowed.includes("/admin/settings") && (
            <Link href="/admin/settings" title="Settings" className="relative grid size-10 place-items-center rounded-full bg-ivory-50/10 ring-1 ring-ivory-50/15 hover:bg-ivory-50/20">
              <Settings className="size-4" />
            </Link>
          )}
          <div className="relative ml-1 flex items-center gap-2.5 rounded-full bg-ivory-50/10 py-1 pl-1 pr-3.5 ring-1 ring-ivory-50/15">
            <span className="grid size-8 place-items-center rounded-full bg-leaf-300 text-xs font-semibold text-forest-950">{initials}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-medium">{staff.name}</span>
              <span className="block text-[11px] text-ivory-50/65">{staff.roleName ?? "No role assigned"}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1360px] px-4 py-6 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
