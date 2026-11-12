import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Panel, Stat, Table, Tray } from "@/components/admin/ui";
import { CustomerActions } from "@/components/admin/CustomerActions";
import { CustomerNoteForm } from "@/components/admin/CustomerNoteForm";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Customer" };

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("customers.view");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true,
      deletionRequestedAt: true, marketingOptIn: true, adminNote: true,
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, createdAt: true, status: true, paymentStatus: true, total: true, amountPaid: true } },
      tickets: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, subject: true, status: true, createdAt: true } },
      returns: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, reason: true, createdAt: true } },
    },
  });
  if (!user) notFound();
  const live = user.orders.filter((o) => o.status !== "CANCELLED");
  const paid = live.reduce((n, o) => n + toPaise(o.amountPaid), 0);
  const canManage = hasPermission(staff.permissions, "customers.manage");

  return (
    <>
      <AdminHeader
        title={user.name}
        description={`${user.email}${user.phone ? ` · ${user.phone}` : ""} · joined ${formatDate(user.createdAt)}`}
        actions={canManage && user.role === "CUSTOMER" ? <CustomerActions userId={user.id} active={user.isActive} /> : undefined}
      />
      {user.deletionRequestedAt && (
        <p className="mb-5 rounded-2xl bg-danger-600/10 px-4 py-3 text-sm text-danger-600">
          The customer requested account deletion on {formatDate(user.deletionRequestedAt)}. Orders must be kept for tax records; suspend the account and remove addresses once any open orders are complete.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={user.orders.length} />
        <Stat label="Paid (excl. cancelled)" value={formatINR(paid)} />
        <Stat label="Average order" value={formatINR(live.length ? Math.round(live.reduce((n, o) => n + toPaise(o.total), 0) / live.length) : 0)} />
        <Stat label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Orders">
          {user.orders.length ? (
            <Table>
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {user.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-green-600 hover:underline">{o.number}</Link></td>
                    <td className="text-ink-500">{formatDate(o.createdAt)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                    <td className="text-right tabular-nums">{formatINR(toPaise(o.total))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-ink-500">No orders yet.</p>
          )}
        </Panel>
        <div className="grid h-fit gap-4">
          <Tray>
            <h2 className="mb-3 text-[15px] font-semibold">Account</h2>
            <dl className="space-y-1.5 rounded-2xl bg-white p-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Status</dt><dd>{user.isActive ? "Active" : "Suspended"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Email verified</dt><dd>{user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "No"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Marketing emails</dt><dd>{user.marketingOptIn ? "Opted in" : "No"}</dd></div>
            </dl>
          </Tray>
          <Tray>
            <h2 className="mb-3 text-[15px] font-semibold">Addresses</h2>
            {user.addresses.length ? (
              <ul className="space-y-2">
                {user.addresses.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-white p-3 text-xs">
                    {a.isDefault && <span className="mb-1 inline-block rounded-full bg-leaf-300 px-2 py-0.5 text-[10px] text-forest-950">Default</span>}
                    <p>{a.fullName} · {a.phone}</p>
                    <p className="text-ink-500">{[a.line1, a.line2, a.city, a.state].filter(Boolean).join(", ")} – {a.pincode}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No saved addresses.</p>
            )}
          </Tray>
          {(user.tickets.length > 0 || user.returns.length > 0) && (
            <Tray>
              <h2 className="mb-3 text-[15px] font-semibold">Support & returns</h2>
              <ul className="space-y-1.5 rounded-2xl bg-white p-4 text-xs">
                {user.tickets.map((t) => <li key={t.id}><Link href={`/admin/support?id=${t.id}`} className="text-green-600 underline">{t.subject}</Link> · {t.status.toLowerCase()} · {formatDate(t.createdAt)}</li>)}
                {user.returns.map((r) => <li key={r.id}><Link href={`/admin/returns/${r.id}`} className="text-green-600 underline">Return</Link> · {r.status.toLowerCase()} · {r.reason}</li>)}
              </ul>
            </Tray>
          )}
          {canManage && (
            <Tray>
              <h2 className="mb-3 text-[15px] font-semibold">Internal note</h2>
              <CustomerNoteForm userId={user.id} note={user.adminNote ?? ""} />
            </Tray>
          )}
        </div>
      </div>
    </>
  );
}
