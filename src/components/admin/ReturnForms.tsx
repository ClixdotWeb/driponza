"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { updateReturnAction } from "@/server/actions/returns";

export function ReturnStepForm({ returnId, to, label, needsNote, items }: { returnId: string; to: string; label: string; needsNote?: boolean; items?: Array<{ id: string; name: string; quantity: number }> }) {
  const router = useRouter();
  const [state, action] = useActionState(updateReturnAction, null);
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="returnId" value={returnId} />
      <input type="hidden" name="to" value={to} />
      {items?.map((i) => (
        <fieldset key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 text-sm">
          <legend className="sr-only">Condition of {i.name}</legend>
          <span>{i.name} × {i.quantity}</span>
          <span className="flex gap-3 text-[13px]">
            <label className="flex items-center gap-1"><input type="radio" name={`cond_${i.id}`} value="RESELLABLE" required className="accent-green-600" /> Resellable</label>
            <label className="flex items-center gap-1"><input type="radio" name={`cond_${i.id}`} value="DAMAGED" className="accent-green-600" /> Damaged</label>
          </span>
        </fieldset>
      ))}
      <input name="note" placeholder={needsNote ? "Reason (sent to customer)" : "Note (optional)"} required={needsNote} className="field-input py-2" aria-label="Note" />
      <SubmitButton className="btn-sm">{label}</SubmitButton>
    </ActionForm>
  );
}
