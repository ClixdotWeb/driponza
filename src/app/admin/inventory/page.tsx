import Link from "next/link";
import { AdminHeader, Empty, Panel, PillTabs, Stat, Table } from "@/components/admin/ui";
import { StockAdjustForm } from "@/components/admin/Forms";
import { ImportForm, PurchaseForm, SupplierForm, WriteOffForm } from "@/components/admin/InventoryForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatINR, toPaise } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Inventory" };

const REASON: Record<string, string> = { INITIAL: "Initial", RESTOCK: "Restock", ADJUSTMENT: "Adjustment", SALE: "Order reserved", CANCELLATION: "Order cancelled", RETURN: "Return (resellable)", DAMAGE: "Damaged", PURCHASE: "Purchase", RESERVATION_RELEASE: "Unpaid order expired" };
const RESERVING = ["PENDING", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP", "ON_HOLD", "CANCEL_REQUESTED"] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string; q?: string }> }) {
  const staff = await requirePermission("inventory.view");
  const canManage = hasPermission(staff.permissions, "inventory.manage");
  const sp = await searchParams;
  const tab = ["stock", "batches", "purchases", "suppliers", "history", "import"].includes(sp.tab ?? "") ? sp.tab! : "stock";
  const soon = new Date(Date.now() + 60 * 864e5);

  const [variants, reserved, batchCount, nearExpiry] = await Promise.all([
    db.productVariant.findMany({ include: { product: { select: { id: true, name: true, isActive: true } } }, orderBy: [{ stock: "asc" }, { product: { name: "asc" } }] }),
    // Units currently held by orders that haven't shipped (already deducted from stock).
    db.orderItem.groupBy({ by: ["variantId"], where: { order: { stockApplied: true, status: { in: [...RESERVING] } } }, _sum: { quantity: true } }),
    db.inventoryBatch.count({ where: { status: "ACTIVE" } }),
    db.inventoryBatch.count({ where: { status: "ACTIVE", quantityRemaining: { gt: 0 }, bestBefore: { lte: soon } } }),
  ]);
  const reservedOf = (id: string) => reserved.find((r) => r.variantId === id)?._sum.quantity ?? 0;
  const q = sp.q?.toLowerCase();
  const shown = variants
    .filter((v) => (sp.filter === "out" ? v.stock <= 0 : sp.filter === "low" ? v.stock > 0 && v.stock <= v.lowStockThreshold : true))
    .filter((v) => (q ? `${v.product.name} ${v.label} ${v.sku}`.toLowerCase().includes(q) : true));
  const stockValue = variants.reduce((n, v) => n + (v.costPrice ? toPaise(v.costPrice) * v.stock : 0), 0);
  const variantOpts = variants.map((v) => ({ id: v.id, label: `${v.product.name} · ${v.label} (${v.sku})` }));

  return (
    <>
      <AdminHeader title="Inventory" description="Orders reserve stock the moment they are placed; cancelled or expired unpaid orders put it back. Every change is in the history." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Variants" value={variants.length} />
        <Stat label="Out of stock" value={variants.filter((v) => v.stock <= 0).length} tone={variants.some((v) => v.stock <= 0) ? "warn" : undefined} href="/admin/inventory?filter=out" />
        <Stat label="Reserved by open orders" value={reserved.reduce((n, r) => n + (r._sum.quantity ?? 0), 0)} />
        <Stat label="Active batches" value={batchCount} hint={nearExpiry ? `${nearExpiry} expiring ≤ 60 days` : undefined} tone={nearExpiry ? "warn" : undefined} href="/admin/inventory?tab=batches" />
        <Stat label="Stock value (at cost)" value={formatINR(stockValue)} hint="Variants with a cost price" />
      </div>
      <PillTabs
        items={[
          ["stock", "Stock"], ["batches", "Batches & expiry"], ["purchases", "Purchases"], ["suppliers", "Suppliers"], ["history", "History"], ...(canManage ? [["import", "Bulk import"]] : []),
        ].map(([k, l]) => ({ label: l, href: `/admin/inventory?tab=${k}`, active: tab === k }))}
      />

      {tab === "stock" && (
        <>
          <form className="mb-3 flex flex-wrap gap-2 text-sm">
            <input type="hidden" name="tab" value="stock" />
            <input name="q" defaultValue={sp.q} placeholder="Search product or SKU" className="field-input w-64 py-2" aria-label="Search" />
            <select name="filter" defaultValue={sp.filter ?? ""} className="field-input w-40 py-2" aria-label="Filter">
              <option value="">All</option><option value="out">Out of stock</option><option value="low">Low stock</option>
            </select>
            <button className="btn btn-sm btn-outline text-forest-800">Apply</button>
          </form>
          <Table>
            <thead><tr><th>Product</th><th>SKU</th><th>Available</th><th>Reserved</th><th>Damaged</th><th>Status</th>{canManage && <th>Adjust</th>}</tr></thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/admin/products/${v.product.id}`} className="font-medium hover:underline">{v.product.name}</Link><span className="block text-xs text-ink-500">{v.label}{!v.isActive || !v.product.isActive ? " · hidden" : ""}{v.costPrice ? ` · cost ${formatINR(toPaise(v.costPrice))}` : ""}</span></td>
                  <td className="text-xs text-ink-500">{v.sku}</td>
                  <td className="text-lg font-semibold tabular-nums">{v.stock}</td>
                  <td className="tabular-nums text-ink-700">{reservedOf(v.id)}</td>
                  <td className="tabular-nums text-ink-700">{v.damagedStock}</td>
                  <td>{v.stock <= 0 ? <span className="text-xs font-medium text-danger-600">Out of stock</span> : v.stock <= v.lowStockThreshold ? <span className="text-xs font-medium text-warning-500">Low (≤ {v.lowStockThreshold})</span> : <span className="text-xs text-green-600">OK</span>}</td>
                  {canManage && <td><StockAdjustForm variantId={v.id} stock={v.stock} /></td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {tab === "batches" && <Batches canManage={canManage} soon={soon} />}
      {tab === "purchases" && <Purchases canManage={canManage} variants={variantOpts} />}
      {tab === "suppliers" && <Suppliers canManage={canManage} />}
      {tab === "history" && <History />}
      {tab === "import" && canManage && <Panel title="Bulk stock & price update"><ImportForm /></Panel>}
    </>
  );
}

async function Batches({ canManage, soon }: { canManage: boolean; soon: Date }) {
  const batches = await db.inventoryBatch.findMany({
    orderBy: [{ status: "asc" }, { bestBefore: { sort: "asc", nulls: "last" } }],
    take: 300,
    include: { variant: { select: { sku: true, label: true, product: { select: { name: true } } } }, supplier: { select: { name: true } }, _count: { select: { allocations: true } } },
  });
  if (!batches.length) return <Empty>No batches yet. Batches are created when you record a purchase with a batch number.</Empty>;
  const now = new Date();
  return (
    <Table>
      <thead><tr><th>Batch</th><th>Product</th><th>Supplier</th><th>Packed</th><th>Best before</th><th>Received</th><th>Remaining</th><th>Status</th>{canManage && <th />}</tr></thead>
      <tbody>
        {batches.map((b) => {
          const expired = b.bestBefore && b.bestBefore < now;
          const nearing = b.bestBefore && !expired && b.bestBefore <= soon;
          return (
            <tr key={b.id}>
              <td className="font-mono text-xs">{b.batchNumber}<span className="block text-[10px] text-ink-500">{b._count.allocations} order line(s)</span></td>
              <td>{b.variant.product.name}<span className="block text-xs text-ink-500">{b.variant.label} · {b.variant.sku}</span></td>
              <td className="text-ink-700">{b.supplier?.name ?? "—"}</td>
              <td className="text-ink-500">{b.packedAt ? formatDate(b.packedAt) : "—"}</td>
              <td className={cn(expired ? "font-medium text-danger-600" : nearing ? "text-warning-500" : "text-ink-500")}>{b.bestBefore ? formatDate(b.bestBefore) : "—"}{expired && b.status === "ACTIVE" ? " · expired" : ""}</td>
              <td className="tabular-nums">{b.quantityReceived}</td>
              <td className="tabular-nums font-medium">{b.quantityRemaining}</td>
              <td className="text-xs">{b.status.toLowerCase()}</td>
              {canManage && <td>{b.status === "ACTIVE" && <WriteOffForm batchId={b.id} />}</td>}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

async function Purchases({ canManage, variants }: { canManage: boolean; variants: Array<{ id: string; label: string }> }) {
  const [entries, suppliers] = await Promise.all([
    db.purchaseEntry.findMany({ orderBy: { purchasedAt: "desc" }, take: 50, include: { supplier: { select: { name: true } }, items: { include: { variant: { select: { label: true, product: { select: { name: true } } } }, batch: { select: { batchNumber: true } } } } } }),
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="grid gap-6">
      {canManage && <Panel title="Record goods received"><PurchaseForm variants={variants} suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))} /></Panel>}
      {entries.length ? (
        <ul className="grid gap-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-[22px] border border-[#eceee9] bg-white p-4 text-sm">
              <p className="font-medium">{formatDate(e.purchasedAt)} · {e.supplier?.name ?? "No supplier"}{e.invoiceRef ? ` · inv ${e.invoiceRef}` : ""}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-700">
                {e.items.map((i) => <li key={i.id}>{i.variant.product.name} · {i.variant.label} × {i.quantity} @ {formatINR(toPaise(i.unitCost))}{i.batch ? ` · batch ${i.batch.batchNumber}` : ""}</li>)}
              </ul>
              <p className="mt-1 text-xs text-ink-500">Total {formatINR(e.items.reduce((n, i) => n + toPaise(i.unitCost) * i.quantity, 0))}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No purchases recorded yet.</Empty>
      )}
    </div>
  );
}

async function Suppliers({ canManage }: { canManage: boolean }) {
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { purchases: true, batches: true } } } });
  return (
    <div className="grid gap-6">
      {canManage && <Panel title="Add supplier"><SupplierForm /></Panel>}
      {suppliers.length ? (
        <Table>
          <thead><tr><th>Supplier</th><th>Contact</th><th>GSTIN</th><th>Purchases</th><th>Batches</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}<span className="block text-xs font-normal text-ink-500">{s.address}</span></td>
                <td className="text-xs">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="font-mono text-xs">{s.gstin ?? "—"}</td>
                <td>{s._count.purchases}</td>
                <td>{s._count.batches}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No suppliers yet.</Empty>
      )}
    </div>
  );
}

async function History() {
  const movements = await db.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { variant: { select: { sku: true, label: true, product: { select: { name: true } } } }, user: { select: { name: true } }, order: { select: { id: true, number: true } } },
  });
  if (!movements.length) return <Empty>No stock changes yet.</Empty>;
  return (
    <Panel>
      <ul className="divide-y divide-[#f2f3f0] text-sm">
        {movements.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
            <span className={cn("w-14 font-medium tabular-nums", m.change > 0 ? "text-green-600" : m.change < 0 ? "text-danger-600" : "text-ink-500")}>{m.change > 0 ? `+${m.change}` : m.change}</span>
            <span className="min-w-48 flex-1">{m.variant.product.name} <span className="text-ink-500">({m.variant.label})</span></span>
            <span className="text-ink-700">{REASON[m.reason] ?? m.reason}{m.order ? <> · <Link href={`/admin/orders/${m.order.id}`} className="text-green-600 underline">{m.order.number}</Link></> : m.note ? ` · ${m.note}` : ""}</span>
            <span className="text-ink-500">→ {m.stockAfter}</span>
            <span className="text-xs text-ink-500">{formatDate(m.createdAt, true)}{m.user ? ` · ${m.user.name}` : ""}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
