import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toPaise } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefixing cells that start with = + - @ stops spreadsheet formula injection.
function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Not authorised", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const where = {
    createdAt: {
      ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59+05:30`) } : {}),
    },
    ...(status ? { status: status as never } : {}),
  };
  const orders = await db.order.findMany({ where, include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } });

  const header = [
    "Order number", "Date (IST)", "Customer", "Email", "Phone", "Status", "Payment status", "Payment method",
    "Razorpay payment id", "Items", "Subtotal", "Discount", "Coupon", "Shipping", "Total", "City", "State", "PIN",
  ];
  const rows = orders.map((o) => [
    o.number,
    o.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    o.customerName,
    o.email,
    o.phone,
    o.status,
    o.paymentStatus,
    o.paymentMethod,
    o.payments[0]?.providerPaymentId ?? "",
    o.items.map((i) => `${i.productName} ${i.variantLabel} x${i.quantity}`).join("; "),
    (toPaise(o.subtotal) / 100).toFixed(2),
    (toPaise(o.discount) / 100).toFixed(2),
    o.couponCode ?? "",
    (toPaise(o.shipping) / 100).toFixed(2),
    (toPaise(o.total) / 100).toFixed(2),
    o.shipCity,
    o.shipState,
    o.shipPincode,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="driponza-orders-${from ?? "all"}-${to ?? "now"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
