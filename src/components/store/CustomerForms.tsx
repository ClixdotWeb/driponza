"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/Form";
import { contactAction, reportReviewAction, submitReviewAction } from "@/server/actions/customer";

export function ContactForm({ defaults }: { defaults?: { name?: string; email?: string } }) {
  const [state, action, pending] = useActionState(contactAction, null);
  if (state?.success) return <FormMessage state={state} />;
  const fe = state?.fieldErrors ?? {};
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`ct-${name}`} className="field-label">{label}</label>
      <input id={`ct-${name}`} name={name} className="field-input" aria-invalid={fe[name] ? true : undefined} {...props} />
      {fe[name] && <p className="field-error">{fe[name]}</p>}
    </div>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      {field("name", "Your name", { defaultValue: defaults?.name, autoComplete: "name", required: true })}
      {field("email", "Email", { type: "email", defaultValue: defaults?.email, autoComplete: "email", required: true })}
      {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
      {field("orderNumber", "Order number (optional)")}
      <div className="sm:col-span-2">{field("subject", "Subject", { required: true })}</div>
      <div className="sm:col-span-2">
        <label htmlFor="ct-message" className="field-label">Message</label>
        <textarea id="ct-message" name="message" className="field-input min-h-32" required aria-invalid={fe.message ? true : undefined} />
        {fe.message && <p className="field-error">{fe.message}</p>}
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send message"}</button></div>
    </form>
  );
}

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, null);
  const [rating, setRating] = useState(0);
  if (state?.success) return <FormMessage state={state} />;
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="field-label">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating >= n} onClick={() => setRating(n)} className={`text-2xl leading-none transition ${rating >= n ? "text-amber-500" : "text-cream-200 hover:text-amber-300"}`}>★</button>
          ))}
        </div>
        {fe.rating && <p className="field-error">{fe.rating}</p>}
      </fieldset>
      <input name="title" placeholder="Title (optional)" maxLength={100} className="field-input" aria-label="Review title" />
      <textarea name="body" placeholder="How did you use it? How was the aroma and freshness?" className="field-input min-h-24" maxLength={2000} aria-label="Review" />
      {fe.body && <p className="field-error">{fe.body}</p>}
      <button className="btn btn-primary w-fit" disabled={pending}>{pending ? "Sending…" : "Submit review"}</button>
    </form>
  );
}

export function ReportReview({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return done ? (
    <span className="text-xs text-ink-500">Reported – thanks</span>
  ) : (
    <button type="button" className="text-xs text-ink-500 underline" onClick={async () => { await reportReviewAction(id); setDone(true); }}>Report</button>
  );
}
