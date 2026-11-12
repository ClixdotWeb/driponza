"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, ActionForm } from "@/components/ui/Form";
import { requestDeletionAction, resendVerificationAction, savePreferencesAction } from "@/server/actions/auth";

export function VerifyBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fbefd6] px-4 py-3 text-sm text-[#6b4700]">
      <span>{msg ?? "Please confirm your email address so we can reach you about your orders."}</span>
      {!msg && <button className="font-medium underline" onClick={async () => setMsg((await resendVerificationAction()).message)}>Resend link</button>}
    </div>
  );
}

export function PreferencesForm({ marketing }: { marketing: boolean }) {
  const [state, action] = useActionState(savePreferencesAction, null);
  return (
    <ActionForm action={action} className="grid gap-3 text-sm">
      <FormMessage state={state} />
      <p className="text-ink-700">Order, payment and delivery emails are always sent – they&apos;re part of your order.</p>
      <label className="flex items-center gap-2"><input type="checkbox" name="marketing" defaultChecked={marketing} className="accent-green-600" /> Send me news about new spices and offers</label>
      <SubmitButton className="w-fit">Save preferences</SubmitButton>
    </ActionForm>
  );
}

export function DeleteAccountForm({ requested }: { requested: boolean }) {
  const [state, action] = useActionState(requestDeletionAction, null);
  const [open, setOpen] = useState(false);
  if (requested || state?.success) return <p className="text-sm text-ink-700">{state?.success ?? "You've asked us to delete your account. We'll email you once it's done."}</p>;
  if (!open) return <button className="btn btn-outline text-danger-600" onClick={() => setOpen(true)}>Request account deletion</button>;
  return (
    <ActionForm action={action} className="grid max-w-md gap-3 text-sm">
      <FormMessage state={state} />
      <p className="text-ink-700">We&apos;ll remove your profile and addresses. Order records are kept as required for tax purposes. Enter your password to confirm.</p>
      <input type="password" name="password" autoComplete="current-password" className="field-input" aria-label="Password" required />
      {state?.fieldErrors?.password && <p className="field-error">{state.fieldErrors.password}</p>}
      <div className="flex gap-2">
        <SubmitButton className="btn-outline text-danger-600">Confirm request</SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </ActionForm>
  );
}
