"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { deleteFaqAction, saveFaqAction } from "@/server/actions/admin-store";

type Faq = { id: string; question: string; answer: string; position: number; isPublished: boolean };

function FaqForm({ faq, onDone }: { faq?: Faq; onDone?: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(saveFaqAction, null);
  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-2 rounded-2xl bg-[#f4f5f2] p-4">
      <FormMessage state={state} />
      {faq && <input type="hidden" name="id" value={faq.id} />}
      <input name="question" defaultValue={faq?.question} placeholder="Question" className="field-input py-2" aria-label="Question" required />
      {fe.question && <p className="field-error">{fe.question}</p>}
      <textarea name="answer" defaultValue={faq?.answer} placeholder="Answer" className="field-input min-h-20" aria-label="Answer" required />
      {fe.answer && <p className="field-error">{fe.answer}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input name="position" type="number" min={0} defaultValue={faq?.position ?? 0} className="field-input w-24 py-2" aria-label="Order" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={faq?.isPublished ?? true} className="accent-green-600" /> Published</label>
        <SubmitButton className="btn-sm">{faq ? "Save" : "Add question"}</SubmitButton>
        {onDone && <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>}
      </div>
    </ActionForm>
  );
}

function Row({ faq }: { faq: Faq }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (editing) return <FaqForm faq={faq} onDone={() => setEditing(false)} />;
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl border border-[#eceee9] p-4 text-sm">
      <div>
        <p className="font-medium">{faq.question} {!faq.isPublished && <span className="text-xs text-ink-500">(draft)</span>}</p>
        <p className="mt-1 line-clamp-2 text-ink-700">{faq.answer}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button className="btn btn-sm btn-outline text-forest-800" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-sm text-danger-600" onClick={async () => { if (confirm("Delete this question?")) { await deleteFaqAction(faq.id); router.refresh(); } }}>Delete</button>
      </div>
    </li>
  );
}

export function FaqManager({ items }: { items: Faq[] }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-500">When at least one question is published here, the homepage FAQ uses these instead of the built-in answers.</p>
      <ul className="grid gap-2">{items.map((f) => <Row key={f.id} faq={f} />)}</ul>
      <FaqForm />
    </div>
  );
}
