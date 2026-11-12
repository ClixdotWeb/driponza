import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Bell, ExternalLink, LogOut, Settings } from "lucide-react";
import { AdminNav, NAV } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Driponza Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side staff check on every admin request (the proxy only checks that a cookie exists).
  const staff = await requireStaff();
  const allowed = NAV.filter((i) => hasPermission(staff.permissions, i.perm as Permission)).map((i) => i.href);
  const canVerify = hasPermission(staff.permissions, "payments.verify");
  const pending = canVerify ? await db.bankTransferSubmission.count({ where: { status: "SUBMITTED" } }) : 0;
  const initials = staff.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-svh bg-[#e9ece6] lg:flex lg:gap-3 lg:p-3">
      {/* Rail */}
      <aside className="bg-forest-950 text-ivory-50 print:hidden lg:sticky lg:top-3 lg:flex lg:h-[calc(100svh-1.5rem)] lg:w-[76px] lg:shrink-0 lg:flex-col lg:items-center lg:rounded-[28px] lg:py-5">
        <div className="flex items-center justify-between px-4 py-3 lg:mb-5 lg:block lg:p-0">
          <Link href="/admin" className="grid size-11 place-items-center rounded-2xl bg-ivory-50/10" title="Driponza admin">
            <Image src="/icon.png" alt="Driponza" width={28} height={28} className="size-7" />
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <button className="text-xs text-ivory-50/70">Sign out</button>
          </form>
        </div>
        <span className="mx-auto mb-4 hidden h-px w-8 bg-ivory-50/15 lg:block" />
        <AdminNav allowed={allowed} />
        <form action={logoutAction} className="mt-4 hidden lg:block">
          <button title="Sign out" className="grid size-11 place-items-center rounded-2xl text-[#f08a7e] transition hover:bg-ivory-50/10">
            <LogOut className="size-[18px]" />
          </button>
        </form>
      </aside>

      {/* Canvas */}
      <div className="min-w-0 flex-1 lg:rounded-[28px] lg:bg-white lg:shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-end gap-2 border-b border-[#eef0ec] bg-white px-4 py-3 print:hidden md:px-8 lg:rounded-t-[28px]">
          <Link href="/" className="mr-auto inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-forest-800">
            View store <ExternalLink className="size-3" />
          </Link>
          {canVerify && (
            <Link href="/admin/payments" title="Payments awaiting verification" className="relative grid size-10 place-items-center rounded-full border border-[#eaece8] text-ink-700 hover:border-sage-400">
              <Bell className="size-4" />
              {pending > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">{pending}</span>}
            </Link>
          )}
          {allowed.includes("/admin/settings") && (
            <Link href="/admin/settings" title="Settings" className="grid size-10 place-items-center rounded-full border border-[#eaece8] text-ink-700 hover:border-sage-400">
              <Settings className="size-4" />
            </Link>
          )}
          <div className="ml-1 flex items-center gap-2.5 rounded-full border border-[#eaece8] py-1 pl-1 pr-3.5">
            <span className="grid size-8 place-items-center rounded-full bg-forest-800 text-xs font-semibold text-ivory-50">{initials}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-medium">{staff.name}</span>
              <span className="block text-[11px] text-ink-500">{staff.roleName ?? "No role assigned"}</span>
            </span>
          </div>
        </div>
        <main className="mx-auto max-w-[1360px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
