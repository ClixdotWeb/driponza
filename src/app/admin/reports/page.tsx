import { Download } from "lucide-react";
import { AdminHeader, Panel, Table } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { formatINR } from "@/lib/money";
import { monthLabel, monthlyRevenue, topProducts } from "@/server/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [months, top] = await Promise.all([monthlyRevenue(12), topProducts(10)]);
  const totals = months.reduce((a, m) => ({ orders: a.orders + m.orders, gross: a.gross + m.gross, refunds: a.refunds + m.refunds, net: a.net + m.net }), { orders: 0, gross: 0, refunds: 0, net: 0 });

  return (
    <>
      <AdminHeader title="Sales reports" description="Based on paid orders (online payments verified by Razorpay, and COD orders once delivered)." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Net revenue — last 12 months"><RevenueChart rows={months} /></Panel>
        <Panel title="Export orders">
          <form action="/api/admin/reports/export" className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label">From</label><input type="date" name="from" className="field-input py-2" /></div>
              <div><label className="field-label">To</label><input type="date" name="to" className="field-input py-2" /></div>
            </div>
            <button className="btn btn-primary w-fit"><Download className="size-4" /> Download CSV</button>
            <p className="text-xs text-ink-500">Opens in Excel / Google Sheets. Leave dates empty for all orders.</p>
          </form>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Monthly breakdown">
          <Table>
            <thead><tr><th>Month</th><th>Paid orders</th><th className="text-right">Gross</th><th className="text-right">Refunds</th><th className="text-right">Net</th></tr></thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{m.orders}</td>
                  <td className="text-right tabular-nums">{formatINR(m.gross)}</td>
                  <td className="text-right tabular-nums text-ink-500">{m.refunds ? `−${formatINR(m.refunds)}` : "—"}</td>
                  <td className="text-right font-medium tabular-nums">{formatINR(m.net)}</td>
                </tr>
              ))}
              <tr className="bg-cream-100 font-medium">
                <td>Total</td><td>{totals.orders}</td>
                <td className="text-right tabular-nums">{formatINR(totals.gross)}</td>
                <td className="text-right tabular-nums">{totals.refunds ? `−${formatINR(totals.refunds)}` : "—"}</td>
                <td className="text-right tabular-nums">{formatINR(totals.net)}</td>
              </tr>
            </tbody>
          </Table>
        </Panel>
        <Panel title="Top products (by revenue)">
          {top.length ? (
            <Table>
              <thead><tr><th>Product</th><th>Units</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {top.map((t) => (
                  <tr key={`${t.name}-${t.variant}`}>
                    <td>{t.name}<span className="block text-xs text-ink-500">{t.variant}</span></td>
                    <td>{t.units}</td>
                    <td className="text-right tabular-nums">{formatINR(t.revenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-ink-500">No sales yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
