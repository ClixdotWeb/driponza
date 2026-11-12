"use client";

import { useActionState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { saveCustomerNoteAction } from "@/server/actions/admin-orders";

export function CustomerNoteForm({ userId, note }: { userId: string; note: string }) {
  const [state, action] = useActionState(saveCustomerNoteAction, null);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <textarea name="adminNote" defaultValue={note} className="field-input min-h-20" placeholder="Visible to staff only" aria-label="Customer note" />
      <SubmitButton className="btn-sm">Save note</SubmitButton>
    </ActionForm>
  );
}
