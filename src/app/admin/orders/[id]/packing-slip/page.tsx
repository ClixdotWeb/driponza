import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Packing slip" };

/** Print-friendly packing slip (no prices – it goes inside the parcel). */
export default async function PackingSlip({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders.view");
  const { id } = await params;
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { id }, include: { items: { include: { batches: { include: { batch: { select: { batchNumber: true, bestBefore: true } } } } } }, shipment: true } }),
    getSettings(),
  ]);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-[720px] bg-white p-8 text-sm text-ink-900 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-ink-500">Packing slip – use your browser&apos;s print dialog (or save as PDF).</p>
        <PrintButton />
      </div>
      <div className="flex justify-between border-b border-ink-900 pb-4">
        <div>
          <p className="text-xl font-semibold">{settings.business.legalName || "Driponza"}</p>
          {settings.contact.addressLines.map((l) => <p key={l} className="text-xs text-ink-700">{l}</p>)}
          <p className="text-xs text-ink-700">{settings.contact.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">PACKING SLIP</p>
          <p>Order {order.number}</p>
          <p className="text-xs text-ink-700">{order.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          {order.shipment?.trackingNumber && <p className="text-xs">AWB {order.shipment.trackingNumber} ({order.shipment.carrier})</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase">Ship to</p>
          <p className="mt-1 text-base font-medium">{order.shipName}</p>
          <p>{order.shipLine1}</p>
          {order.shipLine2 && <p>{order.shipLine2}</p>}
          {order.shipLandmark && <p>Near {order.shipLandmark}</p>}
          <p>{order.shipCity}{order.shipDistrict ? `, ${order.shipDistrict}` : ""}</p>
          <p>{order.shipState} – <strong>{order.shipPincode}</strong></p>
          <p>Phone: {order.shipPhone}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase">Payment</p>
          <p className="mt-1 text-base font-medium">{order.paymentMethod === "COD" ? `COD – collect ₹${(Number(order.total) - Number(order.amountPaid)).toFixed(2)}` : "Prepaid"}</p>
          {order.deliveryInstructions && <p className="mt-2 text-xs">Delivery note: {order.deliveryInstructions}</p>}
        </div>
      </div>
      <table className="mt-6 w-full border-collapse text-left">
        <thead><tr className="border-b border-ink-900"><th className="py-2">Item</th><th>SKU</th><th>Batch</th><th className="text-right">Qty</th><th className="w-10 text-right">✓</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-cream-200">
              <td className="py-2">{i.productName}<span className="block text-xs text-ink-700">{i.variantLabel}</span></td>
              <td className="font-mono text-xs">{i.sku}</td>
              <td className="text-xs">{i.batches.map((b) => `${b.batch.batchNumber}×${b.quantity}`).join(", ") || "—"}</td>
              <td className="text-right text-base font-semibold">{i.quantity}</td>
              <td className="text-right">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 text-xs text-ink-700">Thank you for shopping with Driponza.</p>
    </div>
  );
}
