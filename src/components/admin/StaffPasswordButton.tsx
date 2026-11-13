"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/Form";
import { setStaffPasswordAction } from "@/server/actions/admin-store";

/** Characters that can't be mistaken for one another when a password is read aloud or typed. */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function suggestPassword(length = 16) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

/**
 * Lets a Super Admin set another staff member's password. Stored passwords are
 * hashed and can never be read back, so this is the only remedy for a forgotten one.
 */
export function StaffPasswordButton({ userId, name, email, isSelf }: { userId: string; name: string; email: string; isSelf: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(setStaffPasswordAction, null);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => dialog.current?.close(), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  function open() {
    setPassword(suggestPassword());
    setCopied(false);
    dialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked – the password is on screen to copy by hand */
    }
  }

  return (
    <>
      <button type="button" onClick={open} className="btn btn-outline btn-sm whitespace-nowrap text-forest-800">
        <KeyRound className="size-3.5" /> Set password
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[22px] border border-cream-200 bg-white p-0 text-ink-900 shadow-[0_40px_80px_-40px_rgba(18,61,34,0.6)] backdrop:bg-forest-950/35 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 bg-botanical-100/45 px-5 py-4">
          <div className="min-w-0">
            <h2 className="display text-[1.35rem] leading-none text-forest-900">Set a new password</h2>
            <p className="mt-1.5 truncate text-xs text-ink-500">{name} · {email}{isSelf ? " · this is you" : ""}</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="grid size-7 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-white hover:text-forest-800">
            <X className="size-4" />
          </button>
        </div>

        <ActionForm action={action} className="grid gap-4 p-5">
          <input type="hidden" name="userId" value={userId} />

          <div>
            <label className="field-label" htmlFor={`pw-${userId}`}>New password</label>
            <div className="flex gap-2">
              <input
                id={`pw-${userId}`}
                name="password"
                type="text"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" onClick={copy} title="Copy" aria-label="Copy password" className="grid size-[46px] shrink-0 place-items-center rounded-[14px] border border-cream-200 text-ink-500 transition hover:border-forest-800 hover:text-forest-800">
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => setPassword(suggestPassword())} className="text-xs text-green-600 underline-offset-2 hover:underline">
                Suggest another
              </button>
              <span className="text-xs text-ink-500">At least 10 characters</span>
            </div>
            {fe.password && <p className="field-error">{fe.password}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor={`pw2-${userId}`}>Type it again</label>
            <input id={`pw2-${userId}`} name="confirm" type="text" required className="field-input font-mono" autoComplete="off" spellCheck={false} />
            {fe.confirm && <p className="field-error">{fe.confirm}</p>}
          </div>

          <p className="rounded-xl bg-botanical-100/60 px-3 py-2.5 text-xs text-forest-800">
            Copy it now — it is hashed when saved and can never be shown again. {isSelf ? "You stay signed in here; your other devices are signed out." : "This signs them out of every device."}
          </p>

          {state?.error && <p role="alert" className="rounded-xl bg-danger-600/10 px-3 py-2 text-sm text-danger-600">{state.error}</p>}
          {state?.success && <p role="status" className="rounded-xl bg-botanical-100 px-3 py-2 text-sm text-forest-800">{state.success}</p>}

          <div className="flex justify-end gap-2 border-t border-cream-200 pt-4">
            <button type="button" className="btn btn-outline btn-sm text-ink-700" onClick={() => dialog.current?.close()}>Cancel</button>
            <SubmitButton className="px-6 py-2.5" pendingText="Saving…">Set password</SubmitButton>
          </div>
        </ActionForm>
      </dialog>
    </>
  );
}
