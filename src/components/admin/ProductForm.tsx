"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ClipboardList, IndianRupee, Plus, Tag, Trash2 } from "lucide-react";
import { FormSection } from "@/components/admin/ui";
import { FormMessage, SubmitButton } from "@/components/ui/Form";
import { saveProductAction } from "@/server/actions/admin-catalog";

type Variant = {
  id?: string;
  label: string;
  weightGrams: number | null;
  sku: string;
  price: string;
  mrp: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
};

type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  tag: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder: number;
  needsReview: boolean;
  reviewNotes: string;
  variants: Variant[];
};

const newVariant = (): Variant => ({ label: "100 g", weightGrams: 100, sku: "", price: "", mrp: "", stock: 0, lowStockThreshold: 5, isActive: true });

export function ProductForm({ product, categories }: { product?: ProductInput; categories: { id: string; name: string }[] }) {
  const [p, setP] = useState<ProductInput>(
    product ?? { name: "", slug: "", description: "", tag: "", categoryId: categories[0]?.id ?? "", isActive: true, isFeatured: false, featuredOrder: 0, needsReview: false, reviewNotes: "", variants: [newVariant()] },
  );
  const [state, action] = useActionState(saveProductAction, null);
  const fe = state?.fieldErrors ?? {};
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setVar = (i: number, patch: Partial<Variant>) => setP((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="payload" value={JSON.stringify({ ...p, variants: p.variants.map((v) => ({ ...v, stock: v.id ? undefined : v.stock })) })} />
      <FormMessage state={state} />

      <FormSection
        icon={<Tag className="size-4" />}
        title="Details"
        description="Name, category and the copy customers read on the product page."
      >
        <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="p-name">Name</label>
          <input id="p-name" className="field-input" value={p.name} onChange={(e) => set("name", e.target.value)} required />
          {fe.name && <p className="field-error">{fe.name}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="p-slug">URL slug</label>
          <input id="p-slug" className="field-input" value={p.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" />
          {fe.slug && <p className="field-error">{fe.slug}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="p-cat">Category</label>
          <select id="p-cat" className="field-input" value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="p-desc">Description</label>
          <textarea id="p-desc" className="field-input min-h-32" value={p.description} onChange={(e) => set("description", e.target.value)} />
          {fe.description && <p className="field-error">{fe.description}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="p-tag">Tag (badge on card)</label>
          <input id="p-tag" className="field-input" value={p.tag} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. ROYAL AROMA" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 self-end rounded-[18px] border border-cream-200 bg-ivory-50 px-4 py-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-green-600" checked={p.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Visible on store</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-green-600" checked={p.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /> Featured on homepage</label>
          <label className="flex items-center gap-2 text-ink-500">Order <input type="number" min={0} aria-label="Featured order" className="field-input w-16 px-2 py-1.5 text-center" value={p.featuredOrder} onChange={(e) => set("featuredOrder", Number(e.target.value))} /></label>
        </div>
        </div>
      </FormSection>

      <FormSection
        icon={<IndianRupee className="size-4" />}
        title="Weights & pricing"
        description="One row per pack size. Price is what customers pay."
        actions={
          <button type="button" className="btn btn-outline btn-sm text-forest-800" onClick={() => set("variants", [...p.variants, newVariant()])}>
            <Plus className="size-3.5" /> Add variant
          </button>
        }
      >
        {fe.variants && <p className="field-error mb-3">{fe.variants}</p>}
        <div className="grid gap-4">
          {p.variants.map((v, i) => (
            <div key={v.id ?? `new-${i}`} className="overflow-hidden rounded-[18px] border border-cream-200">
              <div className="flex items-center justify-between gap-3 border-b border-cream-100 bg-ivory-50 px-4 py-2.5">
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-500">
                  <span className="grid size-5 place-items-center rounded-full bg-botanical-100 text-[10px] font-medium text-forest-800">{i + 1}</span>
                  {v.label?.trim() || "New variant"}
                </span>
                <span className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-700"><input type="checkbox" className="accent-green-600" checked={v.isActive} onChange={(e) => setVar(i, { isActive: e.target.checked })} /> On</label>
                  {p.variants.length > 1 && (
                    <button type="button" aria-label="Remove variant" className="grid size-7 place-items-center rounded-full text-ink-500 transition hover:bg-danger-600/10 hover:text-danger-600" onClick={() => set("variants", p.variants.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1fr_0.9fr_0.9fr_0.8fr_0.8fr] lg:items-end">
              <div><label className="field-label">Label</label><input aria-label="Label" className="field-input py-2" value={v.label} onChange={(e) => setVar(i, { label: e.target.value })} /></div>
              <div><label className="field-label">Grams</label><input aria-label="Grams" type="number" min={0} className="field-input py-2" value={v.weightGrams ?? ""} onChange={(e) => setVar(i, { weightGrams: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><label className="field-label">SKU</label><input aria-label="SKU" className="field-input py-2 uppercase" value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} />{fe[`variants.${i}.sku`] && <p className="field-error">{fe[`variants.${i}.sku`]}</p>}</div>
              <div><label className="field-label">Price ₹</label><input aria-label="Price ₹" inputMode="decimal" className="field-input py-2" value={v.price} onChange={(e) => setVar(i, { price: e.target.value })} />{fe[`variants.${i}.price`] && <p className="field-error">{fe[`variants.${i}.price`]}</p>}</div>
              <div><label className="field-label">MRP ₹ (optional)</label><input aria-label="MRP ₹" inputMode="decimal" className="field-input py-2" value={v.mrp} onChange={(e) => setVar(i, { mrp: e.target.value })} /></div>
              <div>
                <label className="field-label">Stock</label>
                {v.id ? (
                  <p className="py-2 text-sm">{v.stock} <Link href="/admin/inventory" className="text-xs text-green-600 underline">adjust</Link></p>
                ) : (
                  <input type="number" min={0} className="field-input py-2" value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} />
                )}
              </div>
              <div><label className="field-label">Low at</label><input aria-label="Low at" type="number" min={0} className="field-input py-2" value={v.lowStockThreshold} onChange={(e) => setVar(i, { lowStockThreshold: Number(e.target.value) })} /></div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">MRP (optional) is shown struck through when higher. Stock for existing variants is changed in Inventory so every change is logged.</p>
      </FormSection>

      <FormSection
        icon={<ClipboardList className="size-4" />}
        title="Internal review"
        description="Only your team sees this. Customers never do."
        tone={p.needsReview ? "warn" : undefined}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-green-600" checked={p.needsReview} onChange={(e) => set("needsReview", e.target.checked)} /> Flag for review</label>
        <textarea className="field-input mt-3 min-h-20" placeholder="Notes for the team (not shown to customers)" value={p.reviewNotes} onChange={(e) => set("reviewNotes", e.target.value)} />
      </FormSection>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-full border border-cream-200 bg-white/85 px-4 py-3 shadow-[0_18px_40px_-28px_rgba(18,61,34,0.55)] backdrop-blur">
        <p className="mr-auto pl-2 text-xs text-ink-500">{p.variants.length} variant{p.variants.length === 1 ? "" : "s"} · {p.isActive ? "visible on store" : "hidden from store"}</p>
        <SubmitButton className="px-8 py-3.5" pendingText="Saving…">{p.id ? "Save changes" : "Create product"}</SubmitButton>
      </div>
    </form>
  );
}
