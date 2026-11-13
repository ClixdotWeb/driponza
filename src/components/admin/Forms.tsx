"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import type { FormState } from "@/server/actions/auth";
import {
  adjustStockAction,
  deleteCategoryAction,
  deleteCouponAction,
  saveCategoryAction,
  saveCouponAction,
} from "@/server/actions/admin-catalog";

/** Generic wrapper: a server action form that refreshes the page on success. */
function useRefreshingAction(fn: (s: FormState, f: FormData) => Promise<FormState>) {
  const router = useRouter();
  const [state, action] = useActionState(fn, null);
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return [state, action] as const;
}

type Cat = { id: string; name: string; slug: string; description: string | null; position: number; isActive: boolean; count: number };

export function CategoryForm({ category }: { category?: Cat }) {
  const [state, action] = useRefreshingAction(saveCategoryAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-[1.2fr_1fr_2fr_80px_auto_auto] md:items-end">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div><label className="field-label">Name</label><input aria-label="Name" name="name" defaultValue={category?.name} className="field-input py-2" required />{fe.name && <p className="field-error">{fe.name}</p>}</div>
      <div><label className="field-label">Slug</label><input aria-label="Slug" name="slug" defaultValue={category?.slug} placeholder="auto" className="field-input py-2" /></div>
      <div><label className="field-label">Description</label><input aria-label="Description" name="description" defaultValue={category?.description ?? ""} className="field-input py-2" /></div>
      <div><label className="field-label">Order</label><input aria-label="Order" name="position" type="number" min={0} defaultValue={category?.position ?? 0} className="field-input py-2" /></div>
      <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} className="accent-green-600" /> Active</label>
      <div className="flex gap-2 pb-0.5">
        <SubmitButton className="btn-sm">{category ? "Save" : "Add"}</SubmitButton>
        {category && <DeleteCategory id={category.id} count={category.count} />}
      </div>
      <div className="md:col-span-6"><FormMessage state={state} /></div>
    </ActionForm>
  );
}

function DeleteCategory({ id, count }: { id: string; count: number }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-sm text-danger-600 hover:bg-danger-600/10"
      onClick={async () => {
        if (count > 0) return alert(`This category has ${count} product(s). Move them first.`);
        if (!confirm("Delete this category?")) return;
        const res = await deleteCategoryAction(id);
        if (!res.ok) alert(res.message);
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}

/**
 * One button per row that opens a dialog, so the stock table stays readable
 * instead of repeating form controls on every line. Restocking only: every
 * change is logged as a RESTOCK movement.
 */
export function StockAdjustButton({ variantId, name, label }: { variantId: string; name: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useRefreshingAction(adjustStockAction);
  const [qty, setQty] = useState("");

  useEffect(() => {
    if (state?.success) dialog.current?.close();
  }, [state]);

  function open() {
    setQty("");
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className="btn btn-outline btn-sm whitespace-nowrap text-forest-800">
        <Plus className="size-3.5" /> Add stock
      </button>
      <dialog
        ref={dialog}
        onClose={() => setQty("")}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[22px] border border-cream-200 bg-white p-0 text-ink-900 shadow-[0_40px_80px_-40px_rgba(18,61,34,0.6)] backdrop:bg-forest-950/35 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 bg-botanical-100/45 px-5 py-4">
          <div className="min-w-0">
            <h2 className="display text-[1.35rem] leading-none text-forest-900">Add stock</h2>
            <p className="mt-1.5 truncate text-xs text-ink-500">{name} · {label}</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="grid size-7 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-white hover:text-forest-800">
            <X className="size-4" />
          </button>
        </div>

        <ActionForm action={action} className="grid gap-4 p-5">
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="mode" value="add" />
          <input type="hidden" name="reason" value="RESTOCK" />

          <div>
            <label className="field-label" htmlFor={`qty-${variantId}`}>How many units are you adding?</label>
            <input
              id={`qty-${variantId}`}
              name="quantity"
              type="number"
              min={1}
              required
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="field-input text-center text-[1.6rem] tabular-nums"
            />
            <div className="mt-2 flex gap-2">
              {[10, 25, 50, 100].map((q) => (
                <button key={q} type="button" onClick={() => setQty(String(q))} className="flex-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs text-ink-700 transition hover:border-forest-800 hover:text-forest-800">
                  +{q}
                </button>
              ))}
            </div>
          </div>

          {state?.error && <p role="alert" className="rounded-xl bg-danger-600/10 px-3 py-2 text-sm text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 border-t border-cream-200 pt-4">
            <button type="button" className="btn btn-outline btn-sm text-ink-700" onClick={() => dialog.current?.close()}>Cancel</button>
            <SubmitButton className="px-6 py-2.5" pendingText="Saving…">Add to stock</SubmitButton>
          </div>
        </ActionForm>
      </dialog>
    </>
  );
}

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
  firstOrderOnly: boolean;
  productIds: string[];
  categoryIds: string[];
};

export type CouponScope = { products: Array<{ id: string; name: string }>; categories: Array<{ id: string; name: string }> };

function ScopePicker({ label, name, options, selected }: { label: string; name: string; options: Array<{ id: string; name: string }>; selected: string[] }) {
  return (
    <div className="sm:col-span-2">
      <label className="field-label">{label}</label>
      <select multiple name={name} defaultValue={selected} aria-label={label} className="field-input h-24 py-1 text-[13px]">
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

export function CouponForm({ coupon, onDone, scope }: { coupon?: Coupon; onDone?: () => void; scope?: CouponScope }) {
  const [state, action] = useRefreshingAction(saveCouponAction);
  useEffect(() => {
    if (state?.success) onDone?.();
  }, [state, onDone]);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4"><FormMessage state={state} /></div>
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <div><label className="field-label">Code</label><input aria-label="Code" name="code" defaultValue={coupon?.code} className="field-input py-2 uppercase" required />{fe.code && <p className="field-error">{fe.code}</p>}</div>
      <div><label className="field-label">Type</label><select aria-label="Type" name="type" defaultValue={coupon?.type ?? "PERCENT"} className="field-input py-2"><option value="PERCENT">Percent off</option><option value="FIXED">Fixed ₹ off</option><option value="FREE_SHIPPING">Free shipping</option></select></div>
      <div><label className="field-label">Value</label><input aria-label="Value" name="value" defaultValue={coupon?.value} className="field-input py-2" required />{fe.value && <p className="field-error">{fe.value}</p>}</div>
      <div><label className="field-label">Max discount ₹</label><input aria-label="Max discount ₹" name="maxDiscount" defaultValue={coupon?.maxDiscount} className="field-input py-2" /></div>
      <div><label className="field-label">Min. subtotal ₹</label><input aria-label="Min. subtotal ₹" name="minSubtotal" defaultValue={coupon?.minSubtotal} className="field-input py-2" /></div>
      <div><label className="field-label">Starts</label><input aria-label="Starts" name="startsAt" type="date" defaultValue={coupon?.startsAt} className="field-input py-2" /></div>
      <div><label className="field-label">Ends</label><input aria-label="Ends" name="endsAt" type="date" defaultValue={coupon?.endsAt} className="field-input py-2" /></div>
      <div><label className="field-label">Total uses</label><input aria-label="Total uses" name="usageLimit" inputMode="numeric" defaultValue={coupon?.usageLimit} placeholder="Unlimited" className="field-input py-2" /></div>
      <div><label className="field-label">Uses per customer</label><input aria-label="Uses per customer" name="perUserLimit" inputMode="numeric" defaultValue={coupon?.perUserLimit} placeholder="Unlimited" className="field-input py-2" /></div>
      <ScopePicker label="Only these products (optional)" name="productIds" options={scope?.products ?? []} selected={coupon?.productIds ?? []} />
      <ScopePicker label="Only these categories (optional)" name="categoryIds" options={scope?.categories ?? []} selected={coupon?.categoryIds ?? []} />
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="firstOrderOnly" defaultChecked={coupon?.firstOrderOnly ?? false} className="accent-green-600" /> First order only</label>
      <div className="sm:col-span-2"><label className="field-label">Description (internal)</label><input aria-label="Description" name="description" defaultValue={coupon?.description ?? ""} className="field-input py-2" /></div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isActive" defaultChecked={coupon?.isActive ?? true} className="accent-green-600" /> Active</label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <SubmitButton className="btn-sm">{coupon ? "Save coupon" : "Create coupon"}</SubmitButton>
        {onDone && <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>}
        {coupon && <DeleteCoupon id={coupon.id} />}
      </div>
    </ActionForm>
  );
}

function DeleteCoupon({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-sm text-danger-600 hover:bg-danger-600/10" onClick={async () => { if (confirm("Delete this coupon? Used coupons are deactivated instead.")) { await deleteCouponAction(id); router.refresh(); } }}>
      Delete
    </button>
  );
}

export function CouponRow({ coupon, summary, scope }: { coupon: Coupon; summary: React.ReactNode; scope?: CouponScope }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-5">
      {editing ? (
        <CouponForm coupon={coupon} scope={scope} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {summary}
          <button className="btn btn-sm btn-outline text-forest-800" onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
    </li>
  );
}
