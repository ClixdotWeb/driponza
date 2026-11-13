import "server-only";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import type { Permission } from "@/lib/permissions";
import type { OrderStatus } from "@/generated/prisma/enums";

export type Report = { title: string; description: string; columns: string[]; rows: Array<Array<string | number>>; totals?: Array<string | number> };
export type Range = { from: Date; to: Date };

const IST = "Asia/Kolkata";
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });
const rs = (p: number) => formatINR(p);
const SOLD: { notIn: OrderStatus[] } = { notIn: ["CANCELLED", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PENDING", "PAYMENT_FAILED"] };

export const REPORTS: Record<string, { label: string; perm: Permission }> = {
  sales: { label: "Sales by day", perm: "reports.financial" },
  monthly: { label: "Sales by month", perm: "reports.financial" },
  products: { label: "Product sales", perm: "reports.view" },
  categories: { label: "Category performance", perm: "reports.view" },
  customers: { label: "Customers (new vs repeat)", perm: "reports.view" },
  coupons: { label: "Coupon performance", perm: "reports.view" },
  methods: { label: "Payment methods", perm: "reports.financial" },
  transfers: { label: "Bank-transfer verification", perm: "reports.financial" },
  cod: { label: "Cash on delivery", perm: "reports.financial" },
  refunds: { label: "Refunds", perm: "reports.financial" },
  cancellations: { label: "Cancellations", perm: "reports.view" },
  shipping: { label: "Shipping", perm: "reports.view" },
  inventory: { label: "Inventory & low stock", perm: "reports.view" },
  expiry: { label: "Batch expiry", perm: "reports.view" },
  tax: { label: "Tax (GST included)", perm: "reports.financial" },
  profit: { label: "Estimated profit", perm: "reports.financial" },
};

export async function buildReport(name: string, range: Range): Promise<Report> {
  const created = { gte: range.from, lt: range.to };
  switch (name) {
    case "sales": {
      const tx = await db.paymentTransaction.findMany({ where: { createdAt: created }, select: { kind: true, amountPaise: true, createdAt: true, orderId: true } });
      const orders = await db.order.findMany({ where: { createdAt: created }, select: { createdAt: true, status: true, total: true } });
      const days = new Map<string, { orders: number; value: number; received: number; refunded: number }>();
      const get = (k: string) => days.get(k) ?? days.set(k, { orders: 0, value: 0, received: 0, refunded: 0 }).get(k)!;
      for (const o of orders) if (o.status !== "CANCELLED") { const d = get(day(o.createdAt)); d.orders++; d.value += toPaise(o.total); }
      for (const t of tx) { const d = get(day(t.createdAt)); if (t.kind === "REFUND") d.refunded += t.amountPaise; else d.received += t.amountPaise; }
      const rows = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.orders, rs(v.value), rs(v.received), rs(v.refunded), rs(v.received - v.refunded)]);
      const sum = [...days.values()].reduce((a, v) => ({ orders: a.orders + v.orders, value: a.value + v.value, received: a.received + v.received, refunded: a.refunded + v.refunded }), { orders: 0, value: 0, received: 0, refunded: 0 });
      return { title: "Sales by day", description: "Order value = orders placed (not cancelled). Received = verified transfers + COD collected. Net = received − refunds sent.", columns: ["Date", "Orders", "Order value", "Received", "Refunded", "Net"], rows, totals: ["Total", sum.orders, rs(sum.value), rs(sum.received), rs(sum.refunded), rs(sum.received - sum.refunded)] };
    }
    case "monthly": {
      const rows = await db.$queryRaw<Array<{ month: string; orders: bigint; value: string | null; aov: string | null }>>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE ${IST}), 'YYYY-MM') AS month, COUNT(*) AS orders, SUM("total") AS value, AVG("total") AS aov
        FROM "Order" WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to} AND "status" <> 'CANCELLED' GROUP BY 1 ORDER BY 1`;
      return { title: "Sales by month", description: "Average order value (AOV) over non-cancelled orders.", columns: ["Month", "Orders", "Order value", "Average order"], rows: rows.map((r) => [r.month, Number(r.orders), rs(Math.round(Number(r.value ?? 0) * 100)), rs(Math.round(Number(r.aov ?? 0) * 100))]) };
    }
    case "products": {
      const g = await db.orderItem.groupBy({ by: ["productName", "variantLabel", "sku"], where: { order: { createdAt: created, status: SOLD } }, _sum: { quantity: true, lineTotal: true }, _count: { _all: true }, orderBy: { _sum: { lineTotal: "desc" } } });
      return { title: "Product sales", description: "Units and revenue from confirmed (paid/COD) orders.", columns: ["Product", "Variant", "SKU", "Orders", "Units", "Revenue"], rows: g.map((r) => [r.productName, r.variantLabel, r.sku, r._count?._all ?? 0, r._sum?.quantity ?? 0, rs(Math.round(Number(r._sum?.lineTotal ?? 0) * 100))]) };
    }
    case "categories": {
      const rows = await db.$queryRaw<Array<{ name: string; units: bigint; revenue: string | null }>>`
        SELECT c."name", SUM(oi."quantity") AS units, SUM(oi."lineTotal") AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Product" p ON p."id" = oi."productId" JOIN "Category" c ON c."id" = p."categoryId"
        WHERE o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to} AND o."status"::text NOT IN ('CANCELLED','AWAITING_PAYMENT','PAYMENT_VERIFICATION','PENDING','PAYMENT_FAILED')
        GROUP BY c."name" ORDER BY revenue DESC NULLS LAST`;
      return { title: "Category performance", description: "Confirmed orders, by the product's current category.", columns: ["Category", "Units", "Revenue"], rows: rows.map((r) => [r.name, Number(r.units), rs(Math.round(Number(r.revenue ?? 0) * 100))]) };
    }
    case "customers": {
      const orders = await db.order.findMany({ where: { createdAt: created, status: { not: "CANCELLED" } }, select: { email: true, total: true } });
      const before = await db.order.findMany({ where: { createdAt: { lt: range.from }, status: { not: "CANCELLED" }, email: { in: [...new Set(orders.map((o) => o.email))] } }, select: { email: true }, distinct: ["email"] });
      const returning = new Set(before.map((b) => b.email));
      const per = new Map<string, { n: number; v: number }>();
      for (const o of orders) { const p = per.get(o.email) ?? { n: 0, v: 0 }; p.n++; p.v += toPaise(o.total); per.set(o.email, p); }
      const newBuyers = [...per.keys()].filter((e) => !returning.has(e));
      const repeat = [...per.entries()].filter(([e, p]) => returning.has(e) || p.n > 1);
      const signups = await db.user.count({ where: { role: "CUSTOMER", createdAt: created } });
      return {
        title: "Customer acquisition", description: "Buyers identified by email (includes guest checkouts).", columns: ["Metric", "Value"],
        rows: [["New accounts registered", signups], ["Buyers in range", per.size], ["First-time buyers", newBuyers.length], ["Repeat buyers", repeat.length], ["Repeat rate", per.size ? `${Math.round((repeat.length / per.size) * 100)}%` : "—"], ["Average order value", rs(orders.length ? Math.round(orders.reduce((n, o) => n + toPaise(o.total), 0) / orders.length) : 0)]],
      };
    }
    case "coupons": {
      const g = await db.order.groupBy({ by: ["couponCode"], where: { createdAt: created, couponCode: { not: null }, status: { not: "CANCELLED" } }, _count: true, _sum: { discount: true, total: true } });
      return { title: "Coupon performance", description: "Non-cancelled orders that used a coupon.", columns: ["Coupon", "Orders", "Discount given", "Order value"], rows: g.map((r) => [r.couponCode!, r._count, rs(Math.round(Number(r._sum.discount ?? 0) * 100)), rs(Math.round(Number(r._sum.total ?? 0) * 100))]) };
    }
    case "methods": {
      const g = await db.order.groupBy({ by: ["paymentMethod", "paymentStatus"], where: { createdAt: created }, _count: true, _sum: { total: true, amountPaid: true } });
      return { title: "Payment methods", description: "All orders placed in the range by method and payment status.", columns: ["Method", "Payment status", "Orders", "Order value", "Received"], rows: g.map((r) => [r.paymentMethod, r.paymentStatus, r._count, rs(Math.round(Number(r._sum.total ?? 0) * 100)), rs(Math.round(Number(r._sum.amountPaid ?? 0) * 100))]) };
    }
    case "transfers": {
      const subs = await db.bankTransferSubmission.findMany({ where: { createdAt: created }, orderBy: { createdAt: "asc" }, include: { order: { select: { number: true } } } });
      return {
        title: "Bank-transfer verification", description: "Every customer submission and how staff resolved it.", columns: ["Submitted", "Order", "Customer ref", "Claimed", "Status", "Verified amount", "Bank ref", "Reviewed", "Hours to review"],
        rows: subs.map((s) => [s.createdAt.toLocaleString("en-IN", { timeZone: IST }), s.order.number, s.reference, rs(s.amountPaise), s.status, s.verifiedAmountPaise ? rs(s.verifiedAmountPaise) : "", s.bankReference ?? "", s.reviewedAt ? s.reviewedAt.toLocaleString("en-IN", { timeZone: IST }) : "", s.reviewedAt ? ((s.reviewedAt.getTime() - s.createdAt.getTime()) / 3600e3).toFixed(1) : ""]),
      };
    }
    case "cod": {
      const orders = await db.order.findMany({ where: { paymentMethod: "COD", createdAt: created }, orderBy: { createdAt: "asc" }, select: { number: true, createdAt: true, status: true, total: true, amountPaid: true, paymentStatus: true } });
      const due = orders.filter((o) => o.status === "DELIVERED").reduce((n, o) => n + toPaise(o.total) - toPaise(o.amountPaid), 0);
      return { title: "Cash on delivery", description: `Delivered but not yet reconciled: ${rs(due)}.`, columns: ["Order", "Placed", "Status", "Total", "Collected", "Payment"], rows: orders.map((o) => [o.number, day(o.createdAt), o.status, rs(toPaise(o.total)), rs(toPaise(o.amountPaid)), o.paymentStatus]) };
    }
    case "refunds": {
      const r = await db.refund.findMany({ where: { createdAt: created }, orderBy: { createdAt: "asc" }, include: { order: { select: { number: true } } } });
      return { title: "Refunds", description: "PENDING = approved but money not yet sent.", columns: ["Approved", "Order", "Amount", "Method", "Status", "Reference", "Sent on", "Reason"], rows: r.map((x) => [day(x.createdAt), x.order?.number ?? "", rs(x.amountPaise), x.method ?? "", x.status, x.reference ?? "", x.processedAt ? day(x.processedAt) : "", x.reason ?? ""]), totals: ["Total", "", rs(r.filter((x) => x.status !== "FAILED").reduce((n, x) => n + x.amountPaise, 0)), "", "", "", "", ""] };
    }
    case "cancellations": {
      const h = await db.orderStatusHistory.findMany({ where: { status: "CANCELLED", createdAt: created }, orderBy: { createdAt: "asc" }, include: { order: { select: { number: true, total: true, paymentMethod: true } }, by: { select: { name: true } } } });
      return { title: "Cancellations", description: "Who cancelled and why (system = unpaid orders that expired).", columns: ["Date", "Order", "Method", "Value", "By", "Note"], rows: h.map((x) => [day(x.createdAt), x.order.number, x.order.paymentMethod, rs(toPaise(x.order.total)), x.by?.name ?? "system/customer", x.note ?? ""]) };
    }
    case "shipping": {
      const s = await db.shipment.findMany({ where: { createdAt: created }, include: { order: { select: { number: true, shipPincode: true, shipState: true, status: true, createdAt: true } } } });
      return { title: "Shipping", description: "Shipments created in the range with transit time.", columns: ["Order", "Courier", "AWB", "State", "PIN", "Status", "Shipped", "Delivered", "Days to deliver"], rows: s.map((x) => [x.order.number, x.carrier ?? "", x.trackingNumber ?? "", x.order.shipState, x.order.shipPincode, x.order.status, x.shippedAt ? day(x.shippedAt) : "", x.deliveredAt ? day(x.deliveredAt) : "", x.shippedAt && x.deliveredAt ? ((x.deliveredAt.getTime() - x.shippedAt.getTime()) / 864e5).toFixed(1) : ""]) };
    }
    case "inventory": {
      const v = await db.productVariant.findMany({ orderBy: { stock: "asc" }, include: { product: { select: { name: true } } } });
      return { title: "Inventory", description: "Current stock (not range-dependent).", columns: ["Product", "Variant", "SKU", "Available", "Damaged", "Low-stock level", "Status", "Cost", "Value at cost"], rows: v.map((x) => [x.product.name, x.label, x.sku, x.stock, x.damagedStock, x.lowStockThreshold, x.stock <= 0 ? "OUT" : x.stock <= x.lowStockThreshold ? "LOW" : "OK", x.costPrice ? rs(toPaise(x.costPrice)) : "", x.costPrice ? rs(toPaise(x.costPrice) * x.stock) : ""]) };
    }
    case "expiry": {
      const b = await db.inventoryBatch.findMany({ where: { status: "ACTIVE", quantityRemaining: { gt: 0 } }, orderBy: { bestBefore: { sort: "asc", nulls: "last" } }, include: { variant: { select: { sku: true, label: true, product: { select: { name: true } } } } } });
      return { title: "Batch expiry", description: "Active batches by best-before date (as recorded by staff).", columns: ["Batch", "Product", "Variant", "Remaining", "Best before", "Days left"], rows: b.map((x) => [x.batchNumber, x.variant.product.name, x.variant.label, x.quantityRemaining, x.bestBefore ? day(x.bestBefore) : "not recorded", x.bestBefore ? Math.ceil((x.bestBefore.getTime() - Date.now()) / 864e5) : ""]) };
    }
    case "tax": {
      const items = await db.orderItem.findMany({ where: { order: { createdAt: created, status: SOLD } }, select: { hsnCode: true, taxRatePercent: true, lineTotal: true, quantity: true } });
      const g = new Map<string, { units: number; gross: number; tax: number }>();
      for (const i of items) {
        const rate = i.taxRatePercent ? Number(i.taxRatePercent) : 0;
        const k = `${i.hsnCode ?? "—"}|${rate}`;
        const e = g.get(k) ?? { units: 0, gross: 0, tax: 0 };
        const gross = toPaise(i.lineTotal);
        e.units += i.quantity; e.gross += gross; e.tax += rate ? Math.round((gross * rate) / (100 + rate)) : 0;
        g.set(k, e);
      }
      return { title: "Tax summary", description: "GST contained in tax-inclusive line totals, before order-level discounts. Rates come from each product's tax setting at the time of sale; verify with your accountant.", columns: ["HSN", "GST %", "Units", "Gross (incl. GST)", "Taxable value", "GST"], rows: [...g.entries()].map(([k, v]) => { const [hsn, rate] = k.split("|"); return [hsn, rate, v.units, rs(v.gross), rs(v.gross - v.tax), rs(v.tax)]; }) };
    }
    case "profit": {
      const items = await db.orderItem.findMany({ where: { order: { createdAt: created, status: SOLD } }, select: { productName: true, variantLabel: true, quantity: true, lineTotal: true, variant: { select: { costPrice: true } } } });
      const g = new Map<string, { units: number; revenue: number; cost: number; missing: boolean }>();
      for (const i of items) {
        const k = `${i.productName} · ${i.variantLabel}`;
        const e = g.get(k) ?? { units: 0, revenue: 0, cost: 0, missing: false };
        e.units += i.quantity; e.revenue += toPaise(i.lineTotal);
        if (i.variant?.costPrice) e.cost += toPaise(i.variant.costPrice) * i.quantity; else e.missing = true;
        g.set(k, e);
      }
      const rows = [...g.entries()].map(([k, v]) => [k, v.units, rs(v.revenue), v.missing ? "cost missing" : rs(v.cost), v.missing ? "—" : rs(v.revenue - v.cost), v.missing || !v.revenue ? "—" : `${Math.round(((v.revenue - v.cost) / v.revenue) * 100)}%`]);
      return { title: "Estimated gross profit", description: "Revenue minus the variant's latest recorded cost price (from purchase entries). Lines without a cost price are excluded from profit. Excludes shipping, discounts and overheads.", columns: ["Product", "Units", "Revenue", "Cost", "Gross profit", "Margin"], rows };
    }
  }
  return { title: "Unknown report", description: "", columns: [], rows: [] };
}
