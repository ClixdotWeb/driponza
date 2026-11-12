import Link from "next/link";
import { AdminHeader, Empty, Pager, Table } from "@/components/admin/ui";
import { CustomerActions } from "@/components/admin/CustomerActions";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Customers" };
const PER_PAGE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; role?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(sp.q ? { OR: [{ email: { contains: sp.q, mode: "insensitive" } }, { name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } }] } : {}),
    ...(sp.role === "ADMIN" ? { role: "ADMIN" } : sp.role === "CUSTOMER" ? { role: "CUSTOMER" } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { orders: { where: { paidAt: { not: null } }, select: { total: true } }, _count: { select: { orders: true } } } }),
    db.user.count({ where }),
  ]);

  return (
    <>
      <AdminHeader title="Customers" description={`${total} account(s)`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="field-input w-64 py-2" />
        <select name="role" defaultValue={sp.role ?? ""} className="field-input w-40 py-2">
          <option value="">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="ADMIN">Admins</option>
        </select>
        <button className="btn btn-outline btn-sm text-forest-800">Search</button>
      </form>
      {users.length ? (
        <>
          <Table>
            <thead><tr><th>Name</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <td>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-ink-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                  </td>
                  <td className="text-ink-500">{formatDate(u.createdAt)}</td>
                  <td>{u._count.orders > 0 ? <Link href={`/admin/orders?q=${encodeURIComponent(u.email)}`} className="text-green-600 underline">{u._count.orders}</Link> : 0}</td>
                  <td className="tabular-nums">{formatINR(u.orders.reduce((n, o) => n + toPaise(o.total), 0))}</td>
                  <td>{u.role === "ADMIN" ? <span className="rounded-full bg-forest-800 px-2 py-0.5 text-[11px] text-ivory-50">Admin</span> : "Customer"}</td>
                  <td>{u.id !== me?.id ? <CustomerActions userId={u.id} active={u.isActive} role={u.role} /> : <span className="text-xs text-ink-500">You</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pages={Math.ceil(total / PER_PAGE)} href={(p) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`} />
        </>
      ) : (
        <Empty>No accounts found.</Empty>
      )}
    </>
  );
}
