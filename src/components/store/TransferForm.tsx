"use client";

import { useActionState } from "react";
import { submitTransferAction, type TransferState } from "@/server/actions/checkout";

/** Customer submits their bank transfer reference. This never marks the order paid – staff verify it against the bank statement. */
export function TransferForm({ orderNumber, guestKey, amountRupees }: { orderNumber: string; guestKey: string | null; amountRupees: string }) {
  const [state, action, pending] = useActionState<TransferState, FormData>(submitTransferAction, null);
  if (state?.ok) {
    return <p role="status" className="rounded-2xl bg-botanical-100 p-4 text-sm text-forest-800">Thanks! We&apos;ve received your payment details and will confirm your order once the transfer is verified.</p>;
  }
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 text-sm">
      <p className="font-medium">Already paid? Tell us the transfer details</p>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {guestKey && <input type="hidden" name="k" value={guestKey} />}
      <div>
        <label htmlFor="tf-ref" className="field-label">UTR / transaction reference</label>
        <input id="tf-ref" name="reference" className="field-input font-mono uppercase" required maxLength={60} aria-invalid={fe.reference ? true : undefined} />
        {fe.reference && <p className="field-error">{fe.reference}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tf-amt" className="field-label">Amount paid (₹)</label>
          <input id="tf-amt" name="amount" type="number" step="0.01" min="1" defaultValue={amountRupees} className="field-input" required aria-invalid={fe.amount ? true : undefined} />
          {fe.amount && <p className="field-error">{fe.amount}</p>}
        </div>
        <div>
          <label htmlFor="tf-date" className="field-label">Paid on</label>
          <input id="tf-date" name="paidOn" type="date" className="field-input" />
        </div>
      </div>
      <div>
        <label htmlFor="tf-name" className="field-label">Paid from (account holder name, optional)</label>
        <input id="tf-name" name="payerName" className="field-input" maxLength={80} />
      </div>
      <div>
        <label htmlFor="tf-proof" className="field-label">Screenshot (optional)</label>
        <input id="tf-proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp" className="text-xs" />
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-danger-600/10 p-3 text-danger-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Submitting…" : "Submit payment details"}</button>
    </form>
  );
}
