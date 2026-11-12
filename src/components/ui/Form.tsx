"use client";

import { createContext, useContext, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { FormState } from "@/server/actions/auth";

const PendingContext = createContext(false);

/**
 * Submits a server action without React 19's automatic form reset, so typed values survive
 * validation errors and saved values stay visible. Use with the `action` from useActionState.
 */
export function ActionForm({
  action,
  confirmMessage,
  children,
  ...rest
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & { action: (fd: FormData) => void; confirmMessage?: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || (confirmMessage && !confirm(confirmMessage))) return;
        const fd = new FormData(e.currentTarget);
        start(() => action(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({ children, className, pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return (
    <button type="submit" disabled={pending} className={cn("btn btn-primary", className)}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-xl bg-danger-600/10 px-4 py-3 text-sm text-danger-600">{state.error}</p>;
  if (state.success) return <p role="status" className="rounded-xl bg-botanical-100 px-4 py-3 text-sm text-forest-800">{state.success}</p>;
  return null;
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string };

export function Field({ label, name, error, hint, className, ...rest }: FieldProps) {
  const id = rest.id ?? `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} name={name} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({ label, name, error, className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; error?: string }) {
  const id = rest.id ?? `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea id={id} name={name} className="field-input min-h-28" aria-invalid={error ? true : undefined} {...rest} />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
