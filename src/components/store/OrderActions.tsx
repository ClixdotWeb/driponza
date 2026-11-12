"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelOrderAction } from "@/server/actions/checkout";

export function OrderActions({ number, guestKey, canCancel, needsApproval }: { number: string; guestKey: string | null; canCancel: boolean; needsApproval: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!canCancel && !message) return null;

  return (
    <div className="mt-6 border-t border-cream-200 pt-6">
      {canCancel && !open && (
        <button className="btn btn-outline text-danger-600" onClick={() => setOpen(true)}>
          {needsApproval ? "Request cancellation" : "Cancel order"}
        </button>
      )}
      {open && (
        <form
          className="grid max-w-md gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await cancelOrderAction(number, reason, guestKey ?? undefined);
            setBusy(false);
            setOpen(false);
            setMessage(res.message);
            router.refresh();
          }}
        >
          <label htmlFor="cancel-reason" className="field-label">Why are you cancelling?</label>
          <select id="cancel-reason" className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">Choose a reason</option>
            <option>Ordered by mistake</option>
            <option>Want to change items or quantity</option>
            <option>Delivery takes too long</option>
            <option>Found a better price</option>
            <option>Other</option>
          </select>
          {needsApproval && <p className="text-xs text-ink-500">Your order is already being prepared, so we&apos;ll confirm the cancellation and refund any payment.</p>}
          <div className="flex gap-2">
            <button className="btn btn-outline text-danger-600" disabled={busy || !reason}>{busy ? "Sending…" : needsApproval ? "Request cancellation" : "Cancel order"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Keep order</button>
          </div>
        </form>
      )}
      {message && <p className="mt-3 text-sm text-ink-700" role="status">{message}</p>}
    </div>
  );
}
