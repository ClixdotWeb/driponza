import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Panel, Tray } from "@/components/admin/ui";
import { ReturnStepForm } from "@/components/admin/ReturnForms";
import { RefundForm } from "@/components/admin/OrderForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, paiseToDecimalString, toPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Return" };

export default async function ReturnDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("returns.manage");
  const { id } = await params;
  const ret = await db.returnRequest.findUnique({
    where: { id },
    include: { items: { include: { orderItem: true } }, order: { include: { refunds: true } }, refunds: true },
  });
  if (!ret) notFound();
  const returnedValue = ret.items.reduce((n, i) => n + toPaise(i.orderItem.unitPrice) * i.quantity, 0);
  const committed = ret.order.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountPaise, 0);
  const refundable = Math.max(0, Math.min(returnedValue, toPaise(ret.order.amountPaid) - committed));
  const items = ret.items.map((i) => ({ id: i.id, name: `${i.orderItem.productName} (${i.orderItem.variantLabel})`, quantity: i.quantity }));

  return (
    <>
      <AdminHeader title={`Return · ${ret.order.number}`} description={`Requested ${formatDate(ret.createdAt, true)} · status ${ret.status.toLowerCase()}`} actions={<Link href={`/admin/orders/${ret.orderId}`} className="btn btn-sm btn-outline text-forest-800">Open order</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid h-fit gap-6">
          <Panel title="Request">
            <p className="font-medium">{ret.reason}</p>
            {ret.details && <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{ret.details}</p>}
            {ret.imageKeys.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {ret.imageKeys.map((k) => (
                  <a key={k} href={`/api/media/private?key=${encodeURIComponent(k)}`} target="_blank" className="block size-24 overflow-hidden rounded-2xl bg-[#f4f5f2]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/private?key=${encodeURIComponent(k)}`} alt="Customer photo" className="size-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {ret.resolutionNote && <p className="mt-4 rounded-2xl bg-[#f4f5f2] p-3 text-sm">Note: {ret.resolutionNote}</p>}
          </Panel>
          <Panel title="Items">
            <ul className="divide-y divide-[#f2f3f0] text-sm">
              {ret.items.map((i) => (
                <li key={i.id} className="flex justify-between py-2">
                  <span>{i.orderItem.productName} · {i.orderItem.variantLabel} × {i.quantity}</span>
                  <span className="text-ink-500">{i.condition ? i.condition.toLowerCase() : "not inspected"} · {formatINR(toPaise(i.orderItem.unitPrice) * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="grid h-fit gap-4">
          <Tray>
            <h2 className="mb-3 text-[15px] font-semibold">Next step</h2>
            <div className="grid gap-3">
              {ret.status === "REQUESTED" && (
                <>
                  <ReturnStepForm returnId={ret.id} to="APPROVED" label="Approve return" />
                  <ReturnStepForm returnId={ret.id} to="REJECTED" label="Reject return" needsNote />
                </>
              )}
              {ret.status === "APPROVED" && <ReturnStepForm returnId={ret.id} to="RECEIVED" label="Goods received" />}
              {ret.status === "RECEIVED" && <ReturnStepForm returnId={ret.id} to="INSPECTED" label="Save inspection (updates stock)" items={items} />}
              {ret.status === "INSPECTED" && <ReturnStepForm returnId={ret.id} to="CLOSED" label="Close without refund" />}
              {ret.status === "REFUNDED" && <ReturnStepForm returnId={ret.id} to="CLOSED" label="Close return" />}
              {["REJECTED", "CLOSED"].includes(ret.status) && <p className="text-sm text-ink-500">This return is closed.</p>}
            </div>
          </Tray>
          {ret.status === "INSPECTED" && refundable > 0 && hasPermission(staff.permissions, "refunds.approve") && (
            <Tray>
              <h2 className="mb-3 text-[15px] font-semibold">Refund</h2>
              <div className="rounded-2xl bg-white p-4"><RefundForm orderId={ret.orderId} maxRupees={paiseToDecimalString(refundable)} returnRequestId={ret.id} /></div>
            </Tray>
          )}
          {ret.refunds.length > 0 && (
            <Tray>
              <ul className="space-y-1 rounded-2xl bg-white p-4 text-xs">
                {ret.refunds.map((r) => <li key={r.id}>Refund {formatINR(r.amountPaise)} · {r.status.toLowerCase()}{r.reference ? ` · ref ${r.reference}` : ""}</li>)}
              </ul>
            </Tray>
          )}
        </div>
      </div>
    </>
  );
}
