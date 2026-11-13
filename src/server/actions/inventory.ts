"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, ForbiddenError } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { audit } from "@/server/audit";
import type { FormState } from "@/server/actions/auth";

function refresh() {
  revalidatePath("/admin/inventory");
  revalidatePath("/", "layout"); // storefront stock badges
}
async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    if (err instanceof InventoryError) return { error: err.message };
    console.error("[inventory]", err);
    return { error: "Something went wrong – nothing was changed." };
  }
}
class InventoryError extends Error {}
const date = (s: unknown) => {
  const v = String(s ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// ─────────── Suppliers ───────────

export async function saveSupplierAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("inventory.manage");
    const d = z
      .object({
        id: z.string().cuid().optional().or(z.literal("")),
        name: z.string().trim().min(2, "Enter the supplier name").max(120),
        phone: z.string().trim().max(30).optional(),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        gstin: z.string().trim().toUpperCase().max(15).optional(),
        address: z.string().trim().max(300).optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .safeParse(Object.fromEntries(form));
    if (!d.success) return { error: d.error.issues[0].message };
    const { id, ...data } = d.data;
    const clean = { ...data, phone: data.phone || null, email: data.email || null, gstin: data.gstin || null, address: data.address || null, notes: data.notes || null };
    if (id) await db.supplier.update({ where: { id }, data: clean });
    else await db.supplier.create({ data: clean });
    await audit({ actorId: staff.id, action: "inventory.supplier", entity: "Supplier", entityId: id || null, summary: `Saved supplier ${clean.name}` });
    revalidatePath("/admin/inventory");
    return { success: "Supplier saved." };
  });
}

// ─────────── Purchase entries (stock in) ───────────

const lineSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100_000),
  unitCost: z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter the unit cost"),
  batchNumber: z.string().trim().max(60).regex(/^[A-Za-z0-9\-/ .]*$/, "Batch: letters, digits, - / . only").optional(),
  bestBefore: z.string().optional(),
  packedAt: z.string().optional(),
});

/** Records goods received: increases stock, creates batches (if batch numbers given) and updates last cost price. */
export async function savePurchaseAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("inventory.manage");
    const supplierId = String(form.get("supplierId") ?? "") || null;
    const invoiceRef = String(form.get("invoiceRef") ?? "").trim().slice(0, 60) || null;
    const purchasedAt = date(form.get("purchasedAt")) ?? null;
    if (purchasedAt === null || purchasedAt === undefined) return { error: "Enter the purchase date." };
    const lines: z.infer<typeof lineSchema>[] = [];
    const ids = form.getAll("line.variantId");
    for (let i = 0; i < ids.length; i++) {
      if (!ids[i]) continue;
      const parsed = lineSchema.safeParse({
        variantId: ids[i],
        quantity: form.getAll("line.quantity")[i],
        unitCost: form.getAll("line.unitCost")[i],
        batchNumber: String(form.getAll("line.batchNumber")[i] ?? "") || undefined,
        bestBefore: String(form.getAll("line.bestBefore")[i] ?? "") || undefined,
        packedAt: String(form.getAll("line.packedAt")[i] ?? "") || undefined,
      });
      if (!parsed.success) return { error: `Line ${i + 1}: ${parsed.error.issues[0].message}` };
      lines.push(parsed.data);
    }
    if (!lines.length) return { error: "Add at least one product line." };

    await db.$transaction(async (tx) => {
      const entry = await tx.purchaseEntry.create({ data: { supplierId, invoiceRef, purchasedAt, notes: String(form.get("notes") ?? "").slice(0, 500) || null, createdById: staff.id } });
      for (const l of lines) {
        let batchId: string | null = null;
        if (l.batchNumber) {
          const bb = date(l.bestBefore);
          const pk = date(l.packedAt);
          if (bb === undefined || pk === undefined) throw new InventoryError(`Invalid date for batch ${l.batchNumber}.`);
          const existing = await tx.inventoryBatch.findUnique({ where: { variantId_batchNumber: { variantId: l.variantId, batchNumber: l.batchNumber } } });
          const batch = existing
            ? await tx.inventoryBatch.update({ where: { id: existing.id }, data: { quantityReceived: { increment: l.quantity }, quantityRemaining: { increment: l.quantity }, status: "ACTIVE" } })
            : await tx.inventoryBatch.create({ data: { variantId: l.variantId, batchNumber: l.batchNumber, supplierId, purchasedAt, packedAt: pk, bestBefore: bb, quantityReceived: l.quantity, quantityRemaining: l.quantity } });
          batchId = batch.id;
        }
        await tx.purchaseEntryItem.create({ data: { purchaseEntryId: entry.id, variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost, batchId } });
        const v = await tx.productVariant.update({ where: { id: l.variantId }, data: { stock: { increment: l.quantity }, costPrice: l.unitCost } });
        await tx.inventoryMovement.create({ data: { variantId: l.variantId, change: l.quantity, stockAfter: v.stock, reason: "PURCHASE", note: [invoiceRef, l.batchNumber && `batch ${l.batchNumber}`].filter(Boolean).join(" · ") || null, userId: staff.id } });
      }
      await audit({ tx, actorId: staff.id, action: "inventory.purchase", entity: "PurchaseEntry", entityId: entry.id, summary: `Purchase ${invoiceRef ?? ""}: ${lines.reduce((n, l) => n + l.quantity, 0)} units in ${lines.length} line(s)` });
    });
    refresh();
    return { success: "Purchase recorded and stock updated." };
  });
}

// ─────────── Batch write-off ───────────

/** Marks a batch expired/damaged and removes its remaining units from sellable stock. */
export async function writeOffBatchAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("inventory.manage");
    const d = z.object({ batchId: z.string().cuid(), status: z.enum(["EXPIRED", "DAMAGED"]), note: z.string().trim().max(200).optional() }).parse(Object.fromEntries(form));
    await db.$transaction(async (tx) => {
      const b = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: d.batchId } });
      if (b.status !== "ACTIVE") throw new InventoryError("Only active batches can be written off.");
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: b.variantId } });
      const remove = Math.min(b.quantityRemaining, v.stock);
      const after = await tx.productVariant.update({ where: { id: v.id }, data: { stock: { decrement: remove }, damagedStock: { increment: remove } } });
      await tx.inventoryBatch.update({ where: { id: b.id }, data: { status: d.status, quantityRemaining: 0, notes: d.note ?? b.notes } });
      await tx.inventoryMovement.create({ data: { variantId: v.id, change: -remove, stockAfter: after.stock, reason: "DAMAGE", note: `Batch ${b.batchNumber} ${d.status.toLowerCase()}${d.note ? ` – ${d.note}` : ""}`, userId: staff.id } });
      await audit({ tx, actorId: staff.id, action: "inventory.batch.writeoff", entity: "InventoryBatch", entityId: b.id, summary: `Batch ${b.batchNumber}: ${remove} unit(s) written off (${d.status.toLowerCase()})` });
    });
    refresh();
    return { success: "Batch written off." };
  });
}

// ─────────── Bulk stock / price import (CSV) ───────────

/**
 * CSV columns: sku, stock (absolute, optional), price (optional), mrp (optional), low_stock (optional).
 * Every row is validated first; if any row fails nothing is written and row-level errors are returned.
 */
export async function importStockCsvAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("inventory.manage");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
    if (file.size > 2_000_000) return { error: "CSV must be under 2 MB." };
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return { error: "The file has no data rows." };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (n: string) => header.indexOf(n);
    if (col("sku") < 0) return { error: "Missing a “sku” column." };
    const wantsPrice = col("price") >= 0 || col("mrp") >= 0;
    if (wantsPrice) await assertPermission("products.edit");

    const skus = rows.slice(1).map((r) => r[col("sku")]?.trim()).filter(Boolean) as string[];
    const variants = await db.productVariant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true, stock: true } });
    const errors: string[] = [];
    const updates: Array<{ id: string; sku: string; stock?: number; price?: string; mrp?: string | null; low?: number; before: number }> = [];
    const seen = new Set<string>();
    rows.slice(1).forEach((r, i) => {
      const line = i + 2;
      const sku = r[col("sku")]?.trim();
      const v = variants.find((x) => x.sku === sku);
      if (!sku || !v) return errors.push(`Row ${line}: unknown SKU “${sku ?? ""}”`);
      if (seen.has(sku)) return errors.push(`Row ${line}: duplicate SKU ${sku}`);
      seen.add(sku);
      const u: (typeof updates)[number] = { id: v.id, sku, before: v.stock };
      const cell = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
      if (cell("stock")) {
        if (!/^\d{1,7}$/.test(cell("stock"))) return errors.push(`Row ${line}: stock must be a whole number`);
        u.stock = Number(cell("stock"));
      }
      if (cell("price")) {
        if (!/^\d{1,8}(\.\d{1,2})?$/.test(cell("price"))) return errors.push(`Row ${line}: invalid price`);
        u.price = cell("price");
      }
      if (col("mrp") >= 0) {
        if (cell("mrp") && !/^\d{1,8}(\.\d{1,2})?$/.test(cell("mrp"))) return errors.push(`Row ${line}: invalid MRP`);
        u.mrp = cell("mrp") || null;
      }
      if (cell("low_stock")) {
        if (!/^\d{1,5}$/.test(cell("low_stock"))) return errors.push(`Row ${line}: low_stock must be a whole number`);
        u.low = Number(cell("low_stock"));
      }
      updates.push(u);
    });
    if (errors.length) return { error: `Nothing imported – fix these rows: ${errors.slice(0, 12).join("; ")}${errors.length > 12 ? ` (+${errors.length - 12} more)` : ""}` };

    await db.$transaction(async (tx) => {
      for (const u of updates) {
        const res = await tx.productVariant.updateMany({
          where: { id: u.id, stock: u.before },
          data: { ...(u.stock !== undefined ? { stock: u.stock } : {}), ...(u.price ? { price: u.price } : {}), ...(u.mrp !== undefined ? { mrp: u.mrp } : {}), ...(u.low !== undefined ? { lowStockThreshold: u.low } : {}) },
        });
        if (res.count === 0) throw new InventoryError(`Stock for ${u.sku} changed during import (an order came in) – re-download and retry.`);
        if (u.stock !== undefined && u.stock !== u.before) {
          await tx.inventoryMovement.create({ data: { variantId: u.id, change: u.stock - u.before, stockAfter: u.stock, reason: "ADJUSTMENT", note: "CSV import", userId: staff.id } });
        }
      }
      await audit({ tx, actorId: staff.id, action: "inventory.import", entity: "ProductVariant", summary: `CSV import updated ${updates.length} variant(s)` });
    }, { timeout: 30_000 });
    refresh();
    return { success: `Imported ${updates.length} row(s).` };
  });
}
