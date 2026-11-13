"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { importStockCsvAction, savePurchaseAction, saveSupplierAction, writeOffBatchAction } from "@/server/actions/inventory";
import type { FormState } from "@/server/actions/auth";

function useRefreshing(fn: (s: FormState, f: FormData) => Promise<FormState>) {
  const router = useRouter();
  const [state, action] = useActionState(fn, null);
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return [state, action] as const;
}

type Opt = { id: string; label: string };

export function PurchaseForm({ variants, suppliers }: { variants: Opt[]; suppliers: Opt[] }) {
  const [state, action] = useRefreshing(savePurchaseAction);
  const [lines, setLines] = useState([0]);
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <div className="grid gap-3 md:grid-cols-4">
        <select name="supplierId" className="field-input py-2" aria-label="Supplier" defaultValue="">
          <option value="">Supplier (optional)</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input name="invoiceRef" placeholder="Supplier invoice no." className="field-input py-2" aria-label="Supplier invoice number" />
        <input name="purchasedAt" type="date" defaultValue={today} className="field-input py-2" aria-label="Purchase date" required />
        <input name="notes" placeholder="Notes" className="field-input py-2" aria-label="Notes" />
      </div>
      <div className="grid gap-2">
        {lines.map((key, i) => (
          <div key={key} className="grid gap-2 rounded-2xl bg-[#f4f5f2] p-3 md:grid-cols-[2fr_80px_100px_1fr_140px_140px_auto]">
            <select name="line.variantId" className="field-input py-2 text-[13px]" aria-label={`Line ${i + 1} product`} defaultValue="" required={i === 0}>
              <option value="">Product / variant</option>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <input name="line.quantity" type="number" min={1} placeholder="Qty" className="field-input py-2 text-[13px]" aria-label={`Line ${i + 1} quantity`} />
            <input name="line.unitCost" placeholder="Unit cost ₹" className="field-input py-2 text-[13px]" aria-label={`Line ${i + 1} unit cost`} />
            <input name="line.batchNumber" placeholder="Batch no. (as printed)" className="field-input py-2 text-[13px]" aria-label={`Line ${i + 1} batch number`} />
            <label className="text-[11px] text-ink-500">Packed on<input name="line.packedAt" type="date" className="field-input py-1.5 text-[13px]" /></label>
            <label className="text-[11px] text-ink-500">Best before<input name="line.bestBefore" type="date" className="field-input py-1.5 text-[13px]" /></label>
            {lines.length > 1 ? <button type="button" className="btn btn-sm text-danger-600" onClick={() => setLines((l) => l.filter((k) => k !== key))}>Remove</button> : <span />}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-outline text-forest-800" onClick={() => setLines((l) => [...l, Math.max(...l) + 1])}>+ Add line</button>
        <SubmitButton className="btn-sm">Record purchase</SubmitButton>
      </div>
      <p className="text-[11px] text-ink-500">Enter packing and best-before dates only as printed on the supplier&apos;s packaging – leave them empty if unknown.</p>
    </ActionForm>
  );
}

export function SupplierForm() {
  const [state, action] = useRefreshing(saveSupplierAction);
  return (
    <ActionForm action={action} className="grid gap-2 md:grid-cols-3">
      <div className="md:col-span-3"><FormMessage state={state} /></div>
      <input name="name" placeholder="Supplier name" className="field-input py-2" required aria-label="Supplier name" />
      <input name="phone" placeholder="Phone" className="field-input py-2" aria-label="Phone" />
      <input name="email" type="email" placeholder="Email" className="field-input py-2" aria-label="Email" />
      <input name="gstin" placeholder="GSTIN" className="field-input py-2" aria-label="GSTIN" />
      <input name="address" placeholder="Address" className="field-input py-2 md:col-span-2" aria-label="Address" />
      <SubmitButton className="btn-sm w-fit">Add supplier</SubmitButton>
    </ActionForm>
  );
}

export function WriteOffForm({ batchId }: { batchId: string }) {
  const [state, action] = useRefreshing(writeOffBatchAction);
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="batchId" value={batchId} />
      <select name="status" className="field-input w-auto py-1 text-xs" aria-label="Write-off reason">
        <option value="EXPIRED">Expired</option>
        <option value="DAMAGED">Damaged</option>
      </select>
      <SubmitButton className="btn-sm">Write off</SubmitButton>
      {state?.error && <span className="text-xs text-danger-600">{state.error}</span>}
    </ActionForm>
  );
}

export function ImportForm() {
  const [state, action] = useRefreshing(importStockCsvAction);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept=".csv,text/csv" className="text-xs" aria-label="CSV file" required />
        <SubmitButton className="btn-sm">Validate & import</SubmitButton>
        <a href="/api/admin/inventory/export" className="btn btn-sm btn-outline text-forest-800">Download current sheet</a>
      </div>
      <p className="text-[11px] text-ink-500">Columns: sku, stock, price, mrp, low_stock (others are ignored). All rows are checked first – if any row is wrong, nothing is changed.</p>
    </ActionForm>
  );
}
