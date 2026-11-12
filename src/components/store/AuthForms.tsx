"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} error={fe.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={fe.password} />
      <div className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="text-green-600 hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton className="w-full py-4" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-ink-500">
        New to Driponza?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-green-600 hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registerAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Full name" name="name" autoComplete="name" required defaultValue={state?.values?.name} error={fe.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} error={fe.email} />
      <Field label="Mobile number (optional)" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={state?.values?.phone} error={fe.phone} hint="Used for delivery updates" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} error={fe.password} hint="At least 8 characters" />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required minLength={8} error={fe.confirm} />
      <label className="flex items-start gap-2 text-sm text-ink-700"><input type="checkbox" name="marketing" className="mt-0.5 accent-green-600" /> Email me about new spices and offers (optional)</label>
      <SubmitButton className="w-full py-4" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-green-600 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      {!state?.success && (
        <>
          <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} error={state?.fieldErrors?.email} />
          <SubmitButton className="w-full py-4" pendingText="Sending…">Send reset link</SubmitButton>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-green-600 hover:underline">Back to sign in</Link>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} error={fe.password} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={fe.confirm} />
      <SubmitButton className="w-full py-4" pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}
