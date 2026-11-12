"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { ORDER_STATUS_LABEL } from "@/lib/utils";
import { refundOrderAction, saveAdminNoteAction, saveShipmentAction, syncPaymentAction, updateOrderStatusAction } from "@/server/actions/admin-orders";
import type { FormState } from "@/server/actions/auth";

function useRefreshing(fn: (s: FormState, f: FormData) => Promise<FormState>) {
  const router = useRouter();
  const [state, action] = useActionState(fn, null);
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return [state, action] as const;
}

const STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "ON_HOLD", "CANCELLED"];

export function StatusForm({ orderId, current }: { orderId: string; current: string }) {
  const [state, action] = useRefreshing(updateOrderStatusAction);
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <select name="status" defaultValue={STATUSES.includes(current) ? current : "CONFIRMED"} className="field-input">
        {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
      </select>
      <input name="note" placeholder="Note (optional, shown in timeline)" className="field-input" />
      <SubmitButton>Update status</SubmitButton>
      <p className="text-xs text-ink-500">Customers are emailed when an order is shipped, delivered or cancelled. Cancelling restocks items.</p>
    </ActionForm>
  );
}

export function ShipmentForm({ orderId, shipment }: { orderId: string; shipment: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null } | null }) {
  const [state, action] = useRefreshing(saveShipmentAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input name="carrier" defaultValue={shipment?.carrier ?? ""} placeholder="Courier (e.g. India Post, DTDC)" className="field-input" />
      <input name="trackingNumber" defaultValue={shipment?.trackingNumber ?? ""} placeholder="Tracking number" className="field-input" />
      <input name="trackingUrl" defaultValue={shipment?.trackingUrl ?? ""} placeholder="Tracking link (https://…)" className="field-input" />
      {fe.trackingUrl && <p className="field-error">{fe.trackingUrl}</p>}
      <SubmitButton>Save tracking</SubmitButton>
    </ActionForm>
  );
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string }) {
  const [state, action] = useRefreshing(saveAdminNoteAction);
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <textarea name="adminNote" defaultValue={note} className="field-input min-h-20" placeholder="Visible to admins only" />
      <SubmitButton className="btn-sm">Save note</SubmitButton>
    </ActionForm>
  );
}

export function RefundForm({ orderId, maxPaise }: { orderId: string; maxPaise: number }) {
  const [state, action] = useRefreshing(refundOrderAction);
  return (
    <ActionForm action={action} confirmMessage="Send this refund to Razorpay? This cannot be undone." className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label className="field-label">Amount ₹ (max {(maxPaise / 100).toFixed(2)})</label>
        <input aria-label="Amount ₹" name="amount" defaultValue={(maxPaise / 100).toFixed(2)} className="field-input py-2" />
      </div>
      <div>
        <label className="field-label">Reason</label>
        <input aria-label="Reason" name="reason" className="field-input py-2" placeholder="e.g. Customer cancelled" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cancel" className="accent-green-600" /> Cancel order</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="restock" className="accent-green-600" /> Restock items</label>
      <div className="sm:col-span-2"><SubmitButton className="bg-danger-600 hover:!bg-danger-600/90">Issue refund</SubmitButton></div>
    </ActionForm>
  );
}

export function SyncPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-xs text-ink-500">{msg}</span>}
      <button
        type="button"
        disabled={busy}
        className="btn btn-sm btn-outline text-forest-800"
        onClick={async () => {
          setBusy(true);
          const res = await syncPaymentAction(paymentId);
          setMsg(res.message);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Checking…" : "Verify with Razorpay"}
      </button>
    </span>
  );
}
