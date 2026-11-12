import Link from "next/link";
import { Download } from "lucide-react";
import { AdminHeader, Empty, Pager, PillTabs, Table } from "@/components/admin/ui";
import { BulkStatusForm } from "@/components/admin/OrderForms";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/utils";
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Orders" };
const PER_PAGE = 25;

const TABS: Record<string, { label: string; where: Prisma.OrderWhereInput }> = {
  all: { label: "All", where: {} },
  payment: { label: "Awaiting payment", where: { status: { in: ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PENDING"] } } },
  fulfil: { label: "To fulfil", where: { status: { in: ["CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP"] } } },
  transit: { label: "In transit", where: { status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] } } },
  attention: { label: "Needs attention", where: { status: { in: ["CANCEL_REQUESTED", "RETURN_REQUESTED", "DELIVERY_FAILED", "RTO", "ON_HOLD", "REFUND_PENDING"] } } },
  done: { label: "Completed", where: { status: { in: ["DELIVERED", "RETURNED", "REFUNDED"] } } },
  cancelled: { label: "Cancelled", where: { status: "CANCELLED" } },
};

const BULK: OrderStatus[] = ["PROCESSING", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requirePermission("orders.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tab = sp.tab && sp.tab in TABS ? sp.tab : "all";
  const q = sp.q?.trim().slice(0, 80);
  const base: Prisma.OrderWhereInput = {
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { transfers: { some: { reference: { contains: q, mode: "insensitive" } } } },
            { shipment: { trackingNumber: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(sp.status && sp.status in ORDER_STATUS_LABEL ? { status: sp.status as OrderStatus } : {}),
    ...(sp.payment && sp.payment in PAYMENT_STATUS_LABEL ? { paymentStatus: sp.payment as PaymentStatus } : {}),
    ...(sp.method && ["BANK_TRANSFER", "COD", "RAZORPAY"].includes(sp.method) ? { paymentMethod: sp.method as PaymentMethod } : {}),
    ...(sp.from || sp.to ? { createdAt: { ...(sp.from ? { gte: new Date(`${sp.from}T00:00:00+05:30`) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59+05:30`) } : {}) } } : {}),
  };
  const where: Prisma.OrderWhereInput = { AND: [base, TABS[tab].where] };
  const sort = sp.sort === "total" ? { total: "desc" as const } : sp.sort === "oldest" ? { createdAt: "asc" as const } : { createdAt: "desc" as const };
  const [orders, total, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: sort, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    Promise.all(Object.entries(TABS).map(async ([k, t]) => [k, await db.order.count({ where: { AND: [base, t.where] } })] as const)),
  ]);
  const qs = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders?${params}`;
  };
  const exportParams = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to, status: sp.status, method: sp.method }).filter(([, v]) => v) as [string, string][]);
  const canBulk = hasPermission(staff.permissions, "orders.update");

  const table = (
    <Table>
      <thead>
        <tr>
          {canBulk && <th className="w-8"><span className="sr-only">Select</span></th>}
          <th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th className="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            {canBulk && <td><input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.number}`} className="accent-green-600" /></td>}
            <td>
              <Link href={`/admin/orders/${o.id}`} className="font-medium text-green-600 hover:underline">{o.number}</Link>
              <span className="block text-[11px] text-ink-500">{o.paymentMethod === "COD" ? "COD" : o.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Online (legacy)"}{o.userId ? "" : " · guest"}</span>
            </td>
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
  );

  return (
    <>
      <AdminHeader
        title="Orders"
        description={`${total} order(s) in this view`}
        actions={<a href={`/api/admin/reports/export?${exportParams}`} className="btn btn-outline btn-sm text-forest-800"><Download className="size-3.5" /> Export CSV</a>}
      />
      <PillTabs items={counts.map(([k, n]) => ({ label: TABS[k].label, count: n, href: qs({ tab: k, page: undefined }), active: k === tab }))} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Order, invoice, name, email, phone, UTR, AWB" className="field-input w-80 py-2" aria-label="Search orders" />
        <select name="status" defaultValue={sp.status ?? ""} className="field-input w-48 py-2" aria-label="Order status">
          <option value="">Any status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="payment" defaultValue={sp.payment ?? ""} className="field-input w-44 py-2" aria-label="Payment status">
          <option value="">Any payment</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="method" defaultValue={sp.method ?? ""} className="field-input w-40 py-2" aria-label="Payment method">
          <option value="">Any method</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="COD">COD</option>
        </select>
        <select name="sort" defaultValue={sp.sort ?? ""} className="field-input w-36 py-2" aria-label="Sort">
          <option value="">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="total">Highest total</option>
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="field-input w-40 py-2" aria-label="From date" />
        <input type="date" name="to" defaultValue={sp.to} className="field-input w-40 py-2" aria-label="To date" />
        <button className="btn btn-outline btn-sm text-forest-800">Filter</button>
        {(q || sp.status || sp.payment || sp.method || sp.from || sp.to) && <Link href={`/admin/orders?tab=${tab}`} className="btn btn-sm">Clear</Link>}
      </form>
      {orders.length ? (
        <>
          {canBulk ? <BulkStatusForm statuses={BULK}>{table}</BulkStatusForm> : table}
          <Pager page={page} pages={Math.ceil(total / PER_PAGE)} href={(p) => qs({ page: String(p) })} />
        </>
      ) : (
        <Empty>No orders match these filters.</Empty>
      )}
    </>
  );
}
