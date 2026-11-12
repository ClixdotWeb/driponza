import { db } from "@/lib/db";
import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { toPaise } from "@/lib/money";
import { csvResponse } from "@/lib/csv";
import { audit } from "@/server/audit";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (v: { toString(): string }) => (toPaise(v) / 100).toFixed(2);

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !hasPermission(staff.permissions, "orders.view")) return new Response("Not authorised", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");
  const orders = await db.order.findMany({
    where: {
      createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59+05:30`) } : {}) },
      ...(status ? { status: status as OrderStatus } : {}),
      ...(method ? { paymentMethod: method as PaymentMethod } : {}),
    },
    include: { items: true, shipment: true, transfers: { where: { status: "VERIFIED" } } },
    orderBy: { createdAt: "asc" },
    take: 20000,
  });
  await audit({ actorId: staff.id, action: "export.orders", entity: "Order", summary: `Exported ${orders.length} orders` });

  return csvResponse(
    `driponza-orders-${from ?? "all"}-${to ?? "now"}.csv`,
    ["Order number", "Invoice", "Date (IST)", "Customer", "Email", "Phone", "Status", "Payment status", "Payment method", "Transfer refs", "Items", "Subtotal", "Discount", "Coupon", "Shipping", "COD charge", "GST included", "Total", "Received", "Courier", "AWB", "City", "State", "PIN"],
    orders.map((o) => [
      o.number,
      o.invoiceNumber ?? "",
      o.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      o.customerName,
      o.email,
      o.phone,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      o.transfers.map((t) => t.bankReference || t.reference).join("; "),
      o.items.map((i) => `${i.productName} ${i.variantLabel} x${i.quantity}`).join("; "),
      r2(o.subtotal), r2(o.discount), o.couponCode ?? "", r2(o.shipping), r2(o.codCharge), r2(o.taxTotal), r2(o.total), r2(o.amountPaid),
      o.shipment?.carrier ?? "", o.shipment?.trackingNumber ?? "",
      o.shipCity, o.shipState, o.shipPincode,
    ]),
  );
}
