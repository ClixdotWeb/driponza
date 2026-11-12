"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import {
  addShipmentEventAction,
  bulkStatusAction,
  completeRefundAction,
  createRefundAction,
  recordCodAction,
  reviewTransferAction,
  saveAdminNoteAction,
  saveShipmentAction,
  updateOrderStatusAction,
} from "@/server/actions/admin-orders";
import type { FormState } from "@/server/actions/auth";
import type { OrderStatus } from "@/generated/prisma/enums";

function useRefreshing(fn: (s: FormState, f: FormData) => Promise<FormState>) {
  const router = useRouter();
  const [state, action] = useActionState(fn, null);
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return [state, action] as const;
}

/** Only offers the transitions the server allows from the current status. */
export function StatusForm({ orderId, next }: { orderId: string; next: OrderStatus[] }) {
  const [state, action] = useRefreshing(updateOrderStatusAction);
  if (!next.length) return <p className="text-sm text-ink-500">This order is in a final state.</p>;
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <label key={s} className="cursor-pointer">
            <input type="radio" name="status" value={s} className="peer sr-only" required />
            <span className="inline-block rounded-full border border-[#e3e6e0] px-3.5 py-1.5 text-[13px] transition peer-checked:border-forest-800 peer-checked:bg-forest-800 peer-checked:text-ivory-50 peer-focus-visible:ring-2 peer-focus-visible:ring-leaf-500">
              {ORDER_STATUS_LABEL[s]}
            </span>
          </label>
        ))}
      </div>
      <input name="note" placeholder="Note for the timeline (optional)" className="field-input" maxLength={300} />
      <SubmitButton>Update status</SubmitButton>
      <p className="text-xs text-ink-500">Customers are emailed on key changes. Cancelling before shipment returns stock automatically.</p>
    </ActionForm>
  );
}

type Ship = { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; weightGrams: number | null; pickupAt: Date | null } | null;

export function ShipmentForm({ orderId, shipment }: { orderId: string; shipment: Ship }) {
  const [state, action] = useRefreshing(saveShipmentAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input name="carrier" defaultValue={shipment?.carrier ?? ""} placeholder="Courier (e.g. India Post, DTDC, Delhivery)" className="field-input" aria-label="Courier" />
      <input name="trackingNumber" defaultValue={shipment?.trackingNumber ?? ""} placeholder="AWB / tracking number" className="field-input" aria-label="AWB / tracking number" />
      <input name="trackingUrl" defaultValue={shipment?.trackingUrl ?? ""} placeholder="Tracking link (https://…)" className="field-input" aria-label="Tracking link" />
      {fe.trackingUrl && <p className="field-error">{fe.trackingUrl}</p>}
      <div className="grid grid-cols-2 gap-3">
        <input name="weightGrams" type="number" min={0} defaultValue={shipment?.weightGrams ?? ""} placeholder="Weight (g)" className="field-input" aria-label="Parcel weight in grams" />
        <input name="pickupAt" type="datetime-local" defaultValue={shipment?.pickupAt ? new Date(shipment.pickupAt.getTime() - shipment.pickupAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} className="field-input" aria-label="Pickup time" />
      </div>
      <SubmitButton>Save shipment</SubmitButton>
    </ActionForm>
  );
}

export function ShipmentEventForm({ orderId }: { orderId: string }) {
  const [state, action] = useRefreshing(addShipmentEventAction);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="status" placeholder="Update (e.g. Reached hub)" className="field-input py-2" required aria-label="Tracking update" />
        <input name="location" placeholder="Location" className="field-input py-2" aria-label="Location" />
      </div>
      <SubmitButton className="btn-sm">Add tracking update</SubmitButton>
    </ActionForm>
  );
}

export function TransferReviewForm({ submissionId, suggestedRupees }: { submissionId: string; suggestedRupees: string }) {
  const [state, action] = useRefreshing(reviewTransferAction);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />
      <div className="flex gap-2 text-[13px]">
        <button type="button" onClick={() => setDecision("approve")} className={`rounded-full border px-3 py-1 ${decision === "approve" ? "border-green-600 bg-botanical-100 text-green-600" : "border-[#e3e6e0]"}`}>Matches bank statement</button>
        <button type="button" onClick={() => setDecision("reject")} className={`rounded-full border px-3 py-1 ${decision === "reject" ? "border-danger-600 bg-danger-600/10 text-danger-600" : "border-[#e3e6e0]"}`}>Not received / mismatch</button>
      </div>
      {decision === "approve" ? (
        <div className="grid grid-cols-2 gap-2">
          <input name="verifiedAmount" defaultValue={suggestedRupees} placeholder="Amount on statement (₹)" className="field-input py-2" aria-label="Verified amount" required />
          <input name="bankReference" placeholder="Bank statement ref (optional)" className="field-input py-2" aria-label="Bank reference" />
        </div>
      ) : null}
      <input name="note" placeholder={decision === "reject" ? "Reason (sent to customer)" : "Note (optional)"} className="field-input py-2" required={decision === "reject"} aria-label="Note" />
      <SubmitButton className="btn-sm">{decision === "approve" ? "Verify payment" : "Reject submission"}</SubmitButton>
      <p className="text-[11px] text-ink-500">Only verify after you have seen the money in the bank account – a customer screenshot is not proof.</p>
    </ActionForm>
  );
}

export function CodForm({ orderId, dueRupees }: { orderId: string; dueRupees: string }) {
  const [state, action] = useRefreshing(recordCodAction);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" defaultValue={dueRupees} className="field-input py-2" aria-label="Amount collected" required />
        <input name="reference" placeholder="Courier remittance ref" className="field-input py-2" aria-label="Remittance reference" />
      </div>
      <SubmitButton className="btn-sm">Record COD collected</SubmitButton>
    </ActionForm>
  );
}

export function RefundForm({ orderId, maxRupees, returnRequestId }: { orderId: string; maxRupees: string; returnRequestId?: string }) {
  const [state, action] = useRefreshing(createRefundAction);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      {returnRequestId && <input type="hidden" name="returnRequestId" value={returnRequestId} />}
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" defaultValue={maxRupees} className="field-input py-2" aria-label="Refund amount" required />
        <select name="method" className="field-input py-2" aria-label="Refund method" defaultValue="BANK_TRANSFER">
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="UPI">UPI</option>
          <option value="CASH">Cash</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <input name="reference" placeholder="Bank / UPI ref – leave empty if not sent yet" className="field-input py-2" aria-label="Refund reference" />
      <input name="reason" placeholder="Reason" className="field-input py-2" aria-label="Refund reason" />
      <SubmitButton className="btn-sm">Record refund</SubmitButton>
      <p className="text-[11px] text-ink-500">Max {maxRupees}. Without a reference the refund stays “pending” – the customer is only told it was sent once you add it.</p>
    </ActionForm>
  );
}

export function CompleteRefundForm({ refundId, orderId }: { refundId: string; orderId: string }) {
  const [state, action] = useRefreshing(completeRefundAction);
  return (
    <ActionForm action={action} className="mt-2 flex gap-2">
      <input type="hidden" name="refundId" value={refundId} />
      <input type="hidden" name="orderId" value={orderId} />
      <input name="reference" placeholder="Bank / UPI reference" className="field-input py-1.5 text-xs" aria-label="Refund reference" required />
      <SubmitButton className="btn-sm">Mark sent</SubmitButton>
      <FormMessage state={state} />
    </ActionForm>
  );
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string }) {
  const [state, action] = useRefreshing(saveAdminNoteAction);
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <textarea name="adminNote" defaultValue={note} className="field-input min-h-20" placeholder="Visible to staff only" aria-label="Internal note" />
      <SubmitButton className="btn-sm">Save note</SubmitButton>
    </ActionForm>
  );
}

/** Wraps the orders table: checkboxes named "ids" inside `children` are submitted with the chosen status. */
export function BulkStatusForm({ children, statuses }: { children: React.ReactNode; statuses: OrderStatus[] }) {
  const [state, action] = useRefreshing(bulkStatusAction);
  return (
    <ActionForm action={action}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select name="status" className="field-input w-56 py-2 text-[13px]" aria-label="Bulk status" defaultValue="">
          <option value="" disabled>Bulk: move selected to…</option>
          {statuses.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>
        <SubmitButton className="btn-sm">Apply to selected</SubmitButton>
        <FormMessage state={state} />
      </div>
      {children}
    </ActionForm>
  );
}
