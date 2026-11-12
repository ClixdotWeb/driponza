"use client";

import { useActionState, useState } from "react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { changePasswordAction } from "@/server/actions/auth";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction, updateProfileAction } from "@/server/actions/account";

export function ProfileForm({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Field label="Full name" name="name" defaultValue={name} required error={state?.fieldErrors?.name} />
      <Field label="Mobile number" name="phone" type="tel" defaultValue={phone ?? ""} error={state?.fieldErrors?.phone} />
      <Field label="Email" name="email-readonly" value={email} readOnly disabled hint="Contact us to change your email." className="sm:col-span-2" />
      <div><SubmitButton>Save profile</SubmitButton></div>
    </ActionForm>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Field label="Current password" name="current" type="password" autoComplete="current-password" error={fe.current} className="sm:col-span-2" />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={fe.password} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={fe.confirm} />
      <div><SubmitButton>Change password</SubmitButton></div>
    </ActionForm>
  );
}

type Address = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; district: string | null; state: string; pincode: string; isDefault: boolean };

export function AddressForm({ address, states, onDone }: { address?: Address; states: string[]; onDone?: () => void }) {
  const [state, action] = useActionState(async (prev: Parameters<typeof saveAddressAction>[0], form: FormData) => {
    const res = await saveAddressAction(prev, form);
    if (res?.success) onDone?.();
    return res;
  }, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      {address && <input type="hidden" name="id" value={address.id} />}
      <Field label="Label (e.g. Home, Work)" name="label" defaultValue={address?.label ?? ""} error={fe.label} />
      <Field label="Full name" name="fullName" defaultValue={address?.fullName} required error={fe.fullName} />
      <Field label="Mobile number" name="phone" type="tel" defaultValue={address?.phone} required error={fe.phone} />
      <Field label="PIN code" name="pincode" inputMode="numeric" defaultValue={address?.pincode} required error={fe.pincode} />
      <Field label="House / building, street" name="line1" defaultValue={address?.line1} required error={fe.line1} className="sm:col-span-2" />
      <Field label="Area / locality" name="line2" defaultValue={address?.line2 ?? ""} error={fe.line2} />
      <Field label="Landmark" name="landmark" defaultValue={address?.landmark ?? ""} error={fe.landmark} />
      <Field label="City / town" name="city" defaultValue={address?.city} required error={fe.city} />
      <Field label="District" name="district" defaultValue={address?.district ?? ""} error={fe.district} />
      <div>
        <label htmlFor="f-state" className="field-label">State</label>
        <select id="f-state" name="state" defaultValue={address?.state ?? "Kerala"} className="field-input">
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
        {fe.state && <p className="field-error">{fe.state}</p>}
      </div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="accent-green-600" /> Default address
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>Save address</SubmitButton>
        {onDone && <button type="button" onClick={onDone} className="btn text-ink-700">Cancel</button>}
      </div>
    </ActionForm>
  );
}

export function AddressBook({ addresses, states }: { addresses: Address[]; states: string[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  return (
    <div className="grid gap-4">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="card p-6"><AddressForm address={a} states={states} onDone={() => setEditing(null)} /></div>
        ) : (
          <div key={a.id} className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {a.fullName} {a.label && <span className="ml-1 rounded-full bg-cream-100 px-2 py-0.5 text-[11px]">{a.label}</span>}
                {a.isDefault && <span className="ml-1 rounded-full bg-botanical-100 px-2 py-0.5 text-[11px] text-green-600">Default</span>}
              </p>
              <p className="mt-1 text-ink-700">{[a.line1, a.line2, a.landmark, a.city, a.district, a.state].filter(Boolean).join(", ")} – {a.pincode}</p>
              <p className="text-ink-500">{a.phone}</p>
            </div>
            <div className="flex shrink-0 gap-2 text-sm">
              {!a.isDefault && <button className="btn btn-sm text-forest-800 hover:bg-cream-100" onClick={() => setDefaultAddressAction(a.id)}>Make default</button>}
              <button className="btn btn-sm text-forest-800 hover:bg-cream-100" onClick={() => setEditing(a.id)}>Edit</button>
              <button
                className="btn btn-sm text-danger-600 hover:bg-danger-600/10"
                onClick={() => {
                  if (confirm("Delete this address?")) deleteAddressAction(a.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <div className="card p-6">
          <h3 className="mb-4 font-medium">New address</h3>
          <AddressForm states={states} onDone={addresses.length ? () => setEditing(null) : undefined} />
        </div>
      ) : (
        <button onClick={() => setEditing("new")} className="btn btn-outline w-fit text-forest-800">+ Add address</button>
      )}
    </div>
  );
}
