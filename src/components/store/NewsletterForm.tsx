"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { subscribeNewsletterAction } from "@/server/actions/account";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, null);
  if (state?.success) return <p className="mt-4 text-sm font-medium text-green-600">{state.success}</p>;
  return (
    <form action={action} className="mt-4">
      <div className="flex items-center rounded-full border border-forest-800/25 bg-ivory-50 p-1 pl-4 focus-within:border-green-600">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <input id="newsletter-email" name="email" type="email" required placeholder="you@example.com" className="min-w-0 flex-1 bg-transparent text-sm text-forest-900 outline-none placeholder:text-ink-500" />
        <button disabled={pending} className="btn btn-primary size-10 p-0" aria-label="Subscribe">
          <ArrowRight className="size-4" />
        </button>
      </div>
      {state?.error && <p className="mt-2 text-xs text-danger-600">{state.error}</p>}
    </form>
  );
}
