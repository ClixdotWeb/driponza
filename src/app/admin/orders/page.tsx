import Link from "next/link";
import { Download } from "lucide-react";
import { AdminHeader, Empty, Pager, Table } from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/utils";
import type { OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Orders" };
const PER_PAGE = 25;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where: Prisma.OrderWhereInput = {
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { payments: { some: { providerPaymentId: { contains: q } } } },
          ],
        }
      : {}),
    ...(sp.status && sp.status in ORDER_STATUS_LABEL ? { status: sp.status as OrderStatus } : {}),
    ...(sp.payment && sp.payment in PAYMENT_STATUS_LABEL ? { paymentStatus: sp.payment as PaymentStatus } : {}),
    ...(sp.from || sp.to
      ? { createdAt: { ...(sp.from ? { gte: new Date(`${sp.from}T00:00:00+05:30`) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59+05:30`) } : {}) } }
      : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
  ]);
  const qs = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders?${params}`;
  };
  const exportParams = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to, status: sp.status }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <AdminHeader
        title="Orders"
        description={`${total} order(s)`}
        actions={<a href={`/api/admin/reports/export?${exportParams}`} className="btn btn-outline btn-sm text-forest-800"><Download className="size-3.5" /> Export CSV</a>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Order no., name, email, phone, payment id" className="field-input w-72 py-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="field-input w-48 py-2">
          <option value="">Any status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="payment" defaultValue={sp.payment ?? ""} className="field-input w-44 py-2">
          <option value="">Any payment</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="field-input w-40 py-2" aria-label="From date" />
        <input type="date" name="to" defaultValue={sp.to} className="field-input w-40 py-2" aria-label="To date" />
        <button className="btn btn-outline btn-sm text-forest-800">Filter</button>
        {(q || sp.status || sp.payment || sp.from || sp.to) && <Link href="/admin/orders" className="btn btn-sm">Clear</Link>}
      </form>
      {orders.length ? (
        <>
          <Table>
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-green-600 hover:underline">{o.number}</Link><span className="block text-[11px] text-ink-500">{o.paymentMethod === "COD" ? "COD" : "Online"}</span></td>
                  <td className="text-ink-500">{formatDate(o.createdAt, true)}</td>
                  <td>{o.customerName}<span className="block text-xs text-ink-500">{o.email}</span></td>
                  <td>{o._count.items}</td>
                  <td><OrderStatusBadge status={o.status} />{o.stockIssue && <span className="mt-1 block text-[11px] text-danger-600">Stock issue</span>}</td>
                  <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td className="text-right tabular-nums">{formatINR(toPaise(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pages={Math.ceil(total / PER_PAGE)} href={qs} />
        </>
      ) : (
        <Empty>No orders match these filters.</Empty>
      )}
    </>
  );
}
