"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { deleteRoleAction, deleteZoneAction, inviteStaffAction, moderateReviewAction, saveRoleAction, saveZoneAction, updateTicketAction } from "@/server/actions/admin-store";
import type { FormState } from "@/server/actions/auth";

function useRefreshing(fn: (s: FormState, f: FormData) => Promise<FormState>, onDone?: () => void) {
  const router = useRouter();
  const [state, action] = useActionState(fn, null);
  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);
  return [state, action] as const;
}

export type Zone = {
  id: string; name: string; pincodePrefixes: string[]; states: string[]; rate: string; freeAbove: string; codAllowed: boolean; codCharge: string; minDays: number; maxDays: number; position: number; isActive: boolean;
};

export function ZoneForm({ zone, states, onDone }: { zone?: Zone; states: string[]; onDone?: () => void }) {
  const [state, action] = useRefreshing(saveZoneAction, onDone);
  const fe = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-4"><FormMessage state={state} /></div>
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="md:col-span-2"><label className="field-label">Zone name</label><input name="name" defaultValue={zone?.name} className="field-input py-2" required aria-label="Zone name" /></div>
      <div><label className="field-label">Rate ₹</label><input name="rate" defaultValue={zone?.rate ?? "0"} className="field-input py-2" aria-label="Rate" />{fe.rate && <p className="field-error">{fe.rate}</p>}</div>
      <div><label className="field-label">Free above ₹</label><input name="freeAbove" defaultValue={zone?.freeAbove} placeholder="never" className="field-input py-2" aria-label="Free above" /></div>
      <div className="md:col-span-2">
        <label className="field-label">PIN prefixes (comma separated, e.g. 673, 6730)</label>
        <input name="pincodePrefixes" defaultValue={zone?.pincodePrefixes.join(", ")} className="field-input py-2" aria-label="PIN prefixes" />
        {fe.pincodePrefixes && <p className="field-error">{fe.pincodePrefixes}</p>}
      </div>
      <div className="md:col-span-2">
        <label className="field-label">…or whole states</label>
        <select name="states" multiple defaultValue={zone?.states} className="field-input h-24 py-1 text-[13px]" aria-label="States">
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div><label className="field-label">Delivery days (min)</label><input name="minDays" type="number" min={0} defaultValue={zone?.minDays ?? 3} className="field-input py-2" aria-label="Min days" /></div>
      <div><label className="field-label">Delivery days (max)</label><input name="maxDays" type="number" min={0} defaultValue={zone?.maxDays ?? 7} className="field-input py-2" aria-label="Max days" />{fe.maxDays && <p className="field-error">{fe.maxDays}</p>}</div>
      <div><label className="field-label">COD charge ₹</label><input name="codCharge" defaultValue={zone?.codCharge} className="field-input py-2" aria-label="COD charge" /></div>
      <div><label className="field-label">Priority</label><input name="position" type="number" min={0} defaultValue={zone?.position ?? 0} className="field-input py-2" aria-label="Priority" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="codAllowed" defaultChecked={zone?.codAllowed ?? false} className="accent-green-600" /> COD allowed</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={zone?.isActive ?? true} className="accent-green-600" /> Active</label>
      <div className="flex gap-2 md:col-span-2 md:justify-end">
        <SubmitButton className="btn-sm">{zone ? "Save zone" : "Add zone"}</SubmitButton>
        {onDone && <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>}
      </div>
    </ActionForm>
  );
}

export function ZoneRow({ zone, states, summary }: { zone: Zone; states: string[]; summary: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-[22px] border border-[#eceee9] bg-white p-4">
      {editing ? (
        <ZoneForm zone={zone} states={states} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {summary}
          <div className="flex gap-1">
            <button className="btn btn-sm btn-outline text-forest-800" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-sm text-danger-600" onClick={async () => { if (confirm("Delete this zone?")) { await deleteZoneAction(zone.id); router.refresh(); } }}>Delete</button>
          </div>
        </div>
      )}
    </li>
  );
}

export function RoleForm({ role, permissions, onDone }: { role?: { id: string; name: string; description: string | null; permissions: string[] }; permissions: Array<[string, string]>; onDone?: () => void }) {
  const [state, action] = useRefreshing(saveRoleAction, onDone);
  return (
    <ActionForm action={action} className="grid gap-3">
      <FormMessage state={state} />
      {role && <input type="hidden" name="id" value={role.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <input name="name" defaultValue={role?.name} placeholder="Role name" className="field-input py-2" required aria-label="Role name" />
        <input name="description" defaultValue={role?.description ?? ""} placeholder="Description" className="field-input py-2" aria-label="Role description" />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {permissions.map(([k, label]) => (
          <label key={k} className="flex items-start gap-2 rounded-xl bg-[#f4f5f2] px-3 py-2 text-[13px]">
            <input type="checkbox" name="permissions" value={k} defaultChecked={role?.permissions.includes(k)} className="mt-0.5 accent-green-600" />
            <span>{label}<span className="block text-[10px] text-ink-500">{k}</span></span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <SubmitButton className="btn-sm">{role ? "Save role" : "Create role"}</SubmitButton>
        {onDone && <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>}
      </div>
    </ActionForm>
  );
}

export function RoleCard({ role, permissions, users, editable }: { role: { id: string; name: string; description: string | null; permissions: string[]; isSystem: boolean }; permissions: Array<[string, string]>; users: number; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="rounded-[22px] border border-[#eceee9] bg-white p-5">
      {editing ? (
        <RoleForm role={role} permissions={permissions} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="font-semibold">{role.name} {role.isSystem && <span className="ml-1 rounded-full bg-leaf-300 px-2 py-0.5 text-[10px] text-forest-950">System</span>}</p>
            <p className="text-sm text-ink-500">{role.description}</p>
            <p className="mt-2 text-xs text-ink-700">{role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permissions`} · {users} staff</p>
            {msg && <p className="mt-1 text-xs text-danger-600">{msg}</p>}
          </div>
          {editable && role.id !== "role_super_admin" && (
            <div className="flex gap-1">
              <button className="btn btn-sm btn-outline text-forest-800" onClick={() => setEditing(true)}>Edit</button>
              {!role.isSystem && (
                <button className="btn btn-sm text-danger-600" onClick={async () => { if (!confirm("Delete this role?")) return; const r = await deleteRoleAction(role.id); setMsg(r.error ?? null); router.refresh(); }}>Delete</button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function InviteStaffForm({ roles }: { roles: Array<{ id: string; name: string }> }) {
  const [state, action] = useRefreshing(inviteStaffAction);
  return (
    <ActionForm action={action} className="flex flex-wrap items-start gap-2">
      <input name="email" type="email" placeholder="Their account email" className="field-input w-72 py-2" required aria-label="Staff email" />
      <select name="roleId" className="field-input w-52 py-2" required defaultValue="" aria-label="Role">
        <option value="" disabled>Choose role</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <SubmitButton className="btn-sm">Add staff</SubmitButton>
      <div className="w-full"><FormMessage state={state} /></div>
    </ActionForm>
  );
}

export function ReviewButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-1">
      {status !== "APPROVED" && <button className="btn btn-sm btn-outline text-green-600" onClick={async () => { await moderateReviewAction(id, "APPROVED"); router.refresh(); }}>Approve</button>}
      {status !== "REJECTED" && <button className="btn btn-sm text-danger-600" onClick={async () => { await moderateReviewAction(id, "REJECTED"); router.refresh(); }}>Reject</button>}
    </div>
  );
}

export function TicketForm({ id, status, note }: { id: string; status: string; note: string }) {
  const [state, action] = useRefreshing(updateTicketAction);
  return (
    <ActionForm action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <textarea name="reply" placeholder="Reply to the customer by email (optional)" className="field-input min-h-20" aria-label="Reply" />
      <textarea name="staffNote" defaultValue={note} placeholder="Internal note" className="field-input min-h-14" aria-label="Internal note" />
      <div className="flex gap-2">
        <select name="status" defaultValue={status} className="field-input w-40 py-2" aria-label="Ticket status">
          <option value="OPEN">Open</option>
          <option value="PENDING">Waiting on customer</option>
          <option value="CLOSED">Closed</option>
        </select>
        <SubmitButton className="btn-sm">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
