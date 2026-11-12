import Link from "next/link";
import { AdminHeader, Panel, Table } from "@/components/admin/ui";
import { StockAdjustForm } from "@/components/admin/Forms";
import { db } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Inventory" };

const REASON: Record<string, string> = { INITIAL: "Initial", RESTOCK: "Restock", ADJUSTMENT: "Adjustment", SALE: "Sale", CANCELLATION: "Cancellation", RETURN: "Return" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const variants = await db.productVariant.findMany({
    include: { product: { select: { id: true, name: true, isActive: true } } },
    orderBy: [{ stock: "asc" }, { product: { name: "asc" } }],
  });
  const shown = variants.filter((v) => (filter === "out" ? v.stock <= 0 : filter === "low" ? v.stock > 0 && v.stock <= v.lowStockThreshold : true));
  const movements = await db.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { variant: { select: { sku: true, label: true, product: { select: { name: true } } } }, user: { select: { name: true } } },
  });

  return (
    <>
      <AdminHeader title="Inventory" description="Stock is reduced automatically only after a payment is verified (or a COD order is placed). Every change is recorded below." />
      <div className="mb-4 flex gap-2 text-sm">
        {[["", "All"], ["out", "Out of stock"], ["low", "Low stock"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/inventory?filter=${v}` : "/admin/inventory"} className={cn("chip", (filter ?? "") === v ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200")}>{l}</Link>
        ))}
      </div>
      <Table>
        <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th><th>Adjust</th></tr></thead>
        <tbody>
          {shown.map((v) => (
            <tr key={v.id}>
              <td><Link href={`/admin/products/${v.product.id}`} className="font-medium hover:underline">{v.product.name}</Link><span className="block text-xs text-ink-500">{v.label}{!v.isActive || !v.product.isActive ? " · hidden" : ""}</span></td>
              <td className="text-xs text-ink-500">{v.sku}</td>
              <td className="display text-2xl tabular-nums">{v.stock}</td>
              <td>
                {v.stock <= 0 ? <span className="text-xs font-medium text-danger-600">Out of stock</span> : v.stock <= v.lowStockThreshold ? <span className="text-xs font-medium text-warning-500">Low (≤ {v.lowStockThreshold})</span> : <span className="text-xs text-green-600">OK</span>}
              </td>
              <td><StockAdjustForm variantId={v.id} stock={v.stock} /></td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="mt-8">
        <Panel title="Recent stock history">
          {movements.length ? (
            <ul className="divide-y divide-cream-100 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className={cn("w-14 font-medium tabular-nums", m.change > 0 ? "text-green-600" : m.change < 0 ? "text-danger-600" : "text-ink-500")}>{m.change > 0 ? `+${m.change}` : m.change}</span>
                  <span className="min-w-48 flex-1">{m.variant.product.name} <span className="text-ink-500">({m.variant.label})</span></span>
                  <span className="text-ink-700">{REASON[m.reason]}{m.note ? ` · ${m.note}` : ""}</span>
                  <span className="text-ink-500">→ {m.stockAfter}</span>
                  <span className="text-xs text-ink-500">{formatDate(m.createdAt, true)}{m.user ? ` · ${m.user.name}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No stock changes yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
