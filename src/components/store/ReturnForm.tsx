"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/Form";
import { requestReturnAction } from "@/server/actions/returns";

type Item = { id: string; name: string; variant: string; quantity: number };

export function ReturnForm({ orderNumber, items }: { orderNumber: string; items: Item[] }) {
  const [state, action, pending] = useActionState(requestReturnAction, null);
  if (state?.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-4 text-sm">
      <FormMessage state={state} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <fieldset className="grid gap-2">
        <legend className="field-label">Items to return</legend>
        {items.map((i) => (
          <label key={i.id} className="flex items-center justify-between gap-3 rounded-2xl border border-cream-200 p-3">
            <span>{i.name} <span className="text-ink-500">· {i.variant}</span></span>
            <select name={`qty_${i.id}`} defaultValue="0" className="field-input w-20 py-1.5" aria-label={`Quantity of ${i.name} to return`}>
              {Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="rt-reason" className="field-label">Reason</label>
        <select id="rt-reason" name="reason" className="field-input" required defaultValue="">
          <option value="" disabled>Choose a reason</option>
          <option>Damaged or leaking package</option>
          <option>Wrong item received</option>
          <option>Item missing from the parcel</option>
          <option>Quality not as expected</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="rt-details" className="field-label">Details</label>
        <textarea id="rt-details" name="details" maxLength={1000} className="field-input min-h-24" />
      </div>
      <div>
        <label htmlFor="rt-photos" className="field-label">Photos (up to 3, optional)</label>
        <input id="rt-photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="text-xs" />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Request return"}</button>
    </form>
  );
}
