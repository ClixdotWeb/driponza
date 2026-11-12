import Link from "next/link";
import { AdminHeader, Empty, PillTabs, Table } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import type { ReturnStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Returns" };

const TABS: Record<string, { label: string; statuses: ReturnStatus[] }> = {
  open: { label: "To review", statuses: ["REQUESTED"] },
  transit: { label: "Approved / awaiting goods", statuses: ["APPROVED"] },
  inspect: { label: "To inspect", statuses: ["RECEIVED"] },
  refund: { label: "To refund", statuses: ["INSPECTED"] },
  done: { label: "Closed", statuses: ["REFUNDED", "CLOSED", "REJECTED"] },
};

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("returns.manage");
  const { tab: t } = await searchParams;
  const tab = t && t in TABS ? t : "open";
  const [rows, counts, cancelRequests] = await Promise.all([
    db.returnRequest.findMany({ where: { status: { in: TABS[tab].statuses } }, orderBy: { createdAt: "asc" }, include: { order: { select: { id: true, number: true, customerName: true } }, _count: { select: { items: true } } }, take: 200 }),
    db.returnRequest.groupBy({ by: ["status"], _count: true }),
    db.order.findMany({ where: { status: "CANCEL_REQUESTED" }, select: { id: true, number: true, customerName: true, updatedAt: true } }),
  ]);
  const n = (s: ReturnStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);

  return (
    <>
      <AdminHeader title="Returns & cancellations" description="Stock is returned only after inspection marks items resellable. Refunds are recorded with their bank reference." />
      {cancelRequests.length > 0 && (
        <div className="mb-5 rounded-2xl bg-[#fbefd6] p-4 text-sm text-[#6b4700]">
          <p className="font-medium">Cancellation requests</p>
          <ul className="mt-1 space-y-0.5">
            {cancelRequests.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link> · {o.customerName} · {formatDate(o.updatedAt, true)}</li>)}
          </ul>
        </div>
      )}
      <PillTabs items={Object.entries(TABS).map(([k, v]) => ({ label: v.label, count: n(v.statuses), href: `/admin/returns?tab=${k}`, active: k === tab }))} />
      {rows.length ? (
        <Table>
          <thead><tr><th>Requested</th><th>Order</th><th>Customer</th><th>Reason</th><th>Items</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-ink-500">{formatDate(r.createdAt, true)}</td>
                <td><Link href={`/admin/returns/${r.id}`} className="font-medium text-green-600 hover:underline">{r.order.number}</Link></td>
                <td>{r.order.customerName}</td>
                <td>{r.reason}</td>
                <td>{r._count.items}</td>
                <td className="text-xs">{r.status.toLowerCase()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Nothing here.</Empty>
      )}
    </>
  );
}
