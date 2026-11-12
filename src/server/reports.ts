import "server-only";
import { db } from "@/lib/db";

export type MonthRow = { month: string; orders: number; gross: number; refunds: number; net: number };

/** Revenue by calendar month (IST) for the last `months` months. Amounts in paise. */
export async function monthlyRevenue(months = 12): Promise<MonthRow[]> {
  const sales = await db.$queryRaw<{ month: string; orders: bigint; gross: string | null }[]>`
    SELECT to_char(date_trunc('month', "paidAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
           COUNT(*) AS orders,
           SUM("total") AS gross
    FROM "Order"
    WHERE "paidAt" IS NOT NULL
      AND "paidAt" >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - make_interval(months => ${months - 1})) AT TIME ZONE 'Asia/Kolkata'
    GROUP BY 1`;
  const refunds = await db.$queryRaw<{ month: string; refunded: bigint | null }[]>`
    SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
           SUM("amountPaise") AS refunded
    FROM "Refund"
    WHERE "status" <> 'FAILED'
    GROUP BY 1`;

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const rows: MonthRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const s = sales.find((r) => r.month === key);
    const gross = s?.gross ? Math.round(Number(s.gross) * 100) : 0;
    const refunded = Number(refunds.find((r) => r.month === key)?.refunded ?? 0);
    rows.push({ month: key, orders: Number(s?.orders ?? 0), gross, refunds: refunded, net: gross - refunded });
  }
  return rows;
}

export async function topProducts(limit = 8) {
  const rows = await db.orderItem.groupBy({
    by: ["productName", "variantLabel"],
    where: { order: { paidAt: { not: null } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    name: r.productName,
    variant: r.variantLabel,
    units: r._sum.quantity ?? 0,
    revenuePaise: Math.round(Number(r._sum.lineTotal ?? 0) * 100),
  }));
}

export const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
