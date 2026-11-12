import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Driponza Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side role check on every admin request (the proxy only checks that a cookie exists).
  const admin = await requireAdmin();
  return (
    <div className="min-h-svh bg-[#f3f1ea] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="bg-forest-950 text-ivory-50 lg:sticky lg:top-0 lg:h-svh">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-6 lg:py-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/brand/wordmark-ivory.png" alt="Driponza" width={825} height={149} className="h-6 w-auto" />
          </Link>
          <p className="eyebrow text-[10px] text-leaf-300 lg:mt-2">Admin</p>
        </div>
        <AdminNav />
        <div className="hidden px-6 pb-6 text-xs text-ivory-50/60 lg:absolute lg:bottom-0 lg:block">
          <p className="truncate">{admin.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-ivory-50">View store ↗</Link>
            <form action={logoutAction}><button className="hover:text-ivory-50">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
