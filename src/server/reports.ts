import "server-only";
import { db } from "@/lib/db";

// Revenue = money actually received (verified bank transfers + COD collected, from the PaymentTransaction ledger)
// minus refunds actually sent. Legacy gateway orders (before the ledger existed) count by paidAt × total.

export type MonthRow = { month: string; orders: number; gross: number; refunds: number; net: number };

const IST = "Asia/Kolkata";

/** Received / refunded paise between two instants. */
export async function moneyBetween(from: Date, to: Date) {
  const rows = await db.paymentTransaction.groupBy({ by: ["kind"], where: { createdAt: { gte: from, lt: to } }, _sum: { amountPaise: true } });
  const legacy = await db.order.aggregate({ where: { paymentMethod: "RAZORPAY", paidAt: { gte: from, lt: to } }, _sum: { total: true } });
  const received =
    (rows.find((r) => r.kind === "PAYMENT")?._sum.amountPaise ?? 0) + (rows.find((r) => r.kind === "COD_COLLECTION")?._sum.amountPaise ?? 0) + Math.round(Number(legacy._sum.total ?? 0) * 100);
  const refunded = rows.find((r) => r.kind === "REFUND")?._sum.amountPaise ?? 0;
  return { received, refunded, net: received - refunded };
}

/** Revenue by calendar month (IST) for the last `months` months. Amounts in paise. */
export async function monthlyRevenue(months = 12): Promise<MonthRow[]> {
  const ledger = await db.$queryRaw<{ month: string; kind: string; amount: bigint | null; orders: bigint }[]>`
    SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE ${IST}), 'YYYY-MM') AS month, "kind"::text AS kind,
           SUM("amountPaise") AS amount, COUNT(DISTINCT "orderId") AS orders
    FROM "PaymentTransaction"
    WHERE "createdAt" >= (date_trunc('month', now() AT TIME ZONE ${IST}) - make_interval(months => ${months - 1})) AT TIME ZONE ${IST}
    GROUP BY 1, 2`;
  const legacy = await db.$queryRaw<{ month: string; orders: bigint; gross: string | null }[]>`
    SELECT to_char(date_trunc('month', "paidAt" AT TIME ZONE ${IST}), 'YYYY-MM') AS month, COUNT(*) AS orders, SUM("total") AS gross
    FROM "Order"
    WHERE "paymentMethod" = 'RAZORPAY' AND "paidAt" IS NOT NULL
      AND "paidAt" >= (date_trunc('month', now() AT TIME ZONE ${IST}) - make_interval(months => ${months - 1})) AT TIME ZONE ${IST}
    GROUP BY 1`;

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
  const rows: MonthRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = ledger.filter((r) => r.month === key);
    const l = legacy.find((r) => r.month === key);
    const gross = inMonth.filter((r) => r.kind !== "REFUND").reduce((n, r) => n + Number(r.amount ?? 0), 0) + (l?.gross ? Math.round(Number(l.gross) * 100) : 0);
    const refunds = inMonth.filter((r) => r.kind === "REFUND").reduce((n, r) => n + Number(r.amount ?? 0), 0);
    const orders = inMonth.filter((r) => r.kind !== "REFUND").reduce((n, r) => n + Number(r.orders), 0) + Number(l?.orders ?? 0);
    rows.push({ month: key, orders, gross, refunds, net: gross - refunds });
  }
  return rows;
}

/** Best sellers by units in non-cancelled orders within the range. */
export async function topProducts(limit = 8, from?: Date, to?: Date) {
  const rows = await db.orderItem.groupBy({
    by: ["productName", "variantLabel"],
    where: { order: { status: { notIn: ["CANCELLED", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PENDING", "PAYMENT_FAILED"] }, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ name: r.productName, variant: r.variantLabel, units: r._sum.quantity ?? 0, revenuePaise: Math.round(Number(r._sum.lineTotal ?? 0) * 100) }));
}

const IST_OFFSET_MS = 5.5 * 3600_000; // India has no DST
const DAY_MS = 864e5;

/** UTC instant of 00:00 IST on the day containing `at`, shifted by `offsetDays`. */
export function istDayStart(at = new Date(), offsetDays = 0) {
  return new Date(Math.floor((at.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS + offsetDays * DAY_MS);
}

/** All dashboard numbers – every value is a live database query. */
export async function dashboardMetrics(range: { from: Date; to: Date }) {
  const now = new Date();
  const startToday = istDayStart(now);
  const [today, week, month, inRange, statusCounts, methodCounts, customers, newCustomers, products, variants, pendingTransfers, recent, best] = await Promise.all([
    moneyBetween(startToday, now),
    moneyBetween(istDayStart(now, -6), now),
    moneyBetween(istDayStart(now, -29), now),
    moneyBetween(range.from, range.to),
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: range.from, lt: range.to } }, _count: true }),
    db.order.groupBy({ by: ["paymentMethod"], where: { createdAt: { gte: range.from, lt: range.to }, status: { not: "CANCELLED" } }, _count: true, _sum: { total: true } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: range.from, lt: range.to } } }),
    db.product.count({ where: { isActive: true } }),
    db.productVariant.findMany({ where: { isActive: true, product: { isActive: true } }, select: { id: true, sku: true, label: true, stock: true, lowStockThreshold: true, product: { select: { name: true } } } }),
    db.bankTransferSubmission.count({ where: { status: "SUBMITTED" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    topProducts(5, range.from, range.to),
  ]);
  const count = (...s: string[]) => statusCounts.filter((r) => s.includes(r.status)).reduce((n, r) => n + r._count, 0);
  return {
    revenue: { today, week, month, inRange },
    orders: {
      total: statusCounts.reduce((n, r) => n + r._count, 0),
      pending: count("PENDING", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "ON_HOLD"),
      confirmed: count("CONFIRMED"),
      processing: count("PROCESSING", "PACKED", "READY_TO_SHIP"),
      shipped: count("SHIPPED", "OUT_FOR_DELIVERY"),
      delivered: count("DELIVERED"),
      cancelled: count("CANCELLED"),
      attention: count("CANCEL_REQUESTED", "RETURN_REQUESTED", "DELIVERY_FAILED", "RTO", "REFUND_PENDING"),
    },
    methods: methodCounts.map((m) => ({ method: m.paymentMethod, orders: m._count, totalPaise: Math.round(Number(m._sum.total ?? 0) * 100) })),
    customers: { total: customers, new: newCustomers },
    products,
    outOfStock: variants.filter((v) => v.stock <= 0),
    lowStock: variants.filter((v) => v.stock > 0 && v.stock <= v.lowStockThreshold),
    pendingTransfers,
    recent,
    best,
  };
}

export const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
