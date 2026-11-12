import Link from "next/link";
import { Download } from "lucide-react";
import { AdminHeader, Empty, Pager, PillTabs, Table } from "@/components/admin/ui";
import { CustomerActions } from "@/components/admin/CustomerActions";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Customers" };
const PER_PAGE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; tab?: string; sort?: string }> }) {
  const staff = await requirePermission("customers.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 80);
  const base: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const tabs: Record<string, Prisma.UserWhereInput> = {
    all: {},
    buyers: { orders: { some: { status: { not: "CANCELLED" } } } },
    new: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
    suspended: { isActive: false },
    deletion: { deletionRequestedAt: { not: null } },
  };
  const tab = sp.tab && sp.tab in tabs ? sp.tab : "all";
  const where: Prisma.UserWhereInput = { AND: [base, tabs[tab]] };
  const orderBy: Prisma.UserOrderByWithRelationInput = sp.sort === "orders" ? { orders: { _count: "desc" } } : sp.sort === "name" ? { name: "asc" } : { createdAt: "desc" };
  const [users, total, counts] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true, deletionRequestedAt: true, orders: { where: { status: { not: "CANCELLED" } }, select: { amountPaid: true } }, _count: { select: { orders: true } } },
    }),
    db.user.count({ where }),
    Promise.all(Object.entries(tabs).map(async ([k, w]) => [k, await db.user.count({ where: { AND: [base, w] } })] as const)),
  ]);
  const label: Record<string, string> = { all: "All", buyers: "Have ordered", new: "New (30 days)", suspended: "Suspended", deletion: "Deletion requests" };
  const canManage = hasPermission(staff.permissions, "customers.manage");

  return (
    <>
      <AdminHeader
        title="Customers"
        description={`${total} customer account(s). Staff accounts are managed under Staff & roles.`}
        actions={hasPermission(staff.permissions, "customers.export") ? <a href="/api/admin/customers/export" className="btn btn-outline btn-sm text-forest-800"><Download className="size-3.5" /> Export CSV</a> : undefined}
      />
      <PillTabs items={counts.map(([k, n]) => ({ label: label[k], count: n, href: `/admin/customers?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`, active: k === tab }))} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Name, email or phone" className="field-input w-64 py-2" aria-label="Search customers" />
        <select name="sort" defaultValue={sp.sort ?? ""} className="field-input w-40 py-2" aria-label="Sort">
          <option value="">Newest</option>
          <option value="orders">Most orders</option>
          <option value="name">Name</option>
        </select>
        <button className="btn btn-outline btn-sm text-forest-800">Search</button>
      </form>
      {users.length ? (
        <>
          <Table>
            <thead><tr><th>Customer</th><th>Joined</th><th>Last login</th><th>Orders</th><th>Paid</th><th>Status</th>{canManage && <th />}</tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <td>
                    <Link href={`/admin/customers/${u.id}`} className="font-medium text-green-600 hover:underline">{u.name}</Link>
                    <p className="text-xs text-ink-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                  </td>
                  <td className="text-ink-500">{formatDate(u.createdAt)}</td>
                  <td className="text-ink-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}</td>
                  <td>{u._count.orders}</td>
                  <td className="tabular-nums">{formatINR(u.orders.reduce((n, o) => n + toPaise(o.amountPaid), 0))}</td>
                  <td className="text-xs">{!u.isActive ? "Suspended" : u.deletionRequestedAt ? <span className="text-danger-600">Deletion requested</span> : "Active"}</td>
                  {canManage && <td><CustomerActions userId={u.id} active={u.isActive} /></td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pages={Math.ceil(total / PER_PAGE)} href={(p) => `/admin/customers?${new URLSearchParams({ tab, ...(q ? { q } : {}), ...(sp.sort ? { sort: sp.sort } : {}), page: String(p) })}`} />
        </>
      ) : (
        <Empty>No customers found.</Empty>
      )}
    </>
  );
}
