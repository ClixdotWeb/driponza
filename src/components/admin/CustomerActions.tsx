"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setCustomerActiveAction, setStaffRoleAction } from "@/server/actions/admin-orders";

export function CustomerActions({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm text-xs hover:bg-cream-100"
      onClick={async () => {
        if (!confirm(active ? "Suspend this account? They will be signed out and can't log in." : "Re-activate this account?")) return;
        await setCustomerActiveAction(userId, !active);
        router.refresh();
      }}
    >
      {active ? "Suspend" : "Re-activate"}
    </button>
  );
}

/** Staff role picker (staff.manage only). "" removes staff access. */
export function StaffRoleSelect({ userId, current, roles }: { userId: string; current: string | null; roles: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Staff role"
        className="field-input w-48 py-1.5 text-[13px]"
        defaultValue={current ?? ""}
        onChange={async (e) => {
          const label = e.target.selectedOptions[0]?.text ?? "";
          if (!confirm(e.target.value ? `Give this person the "${label}" role? They will be signed out to apply it.` : "Remove all staff access?")) {
            e.target.value = current ?? "";
            return;
          }
          const res = await setStaffRoleAction(userId, e.target.value);
          setMsg(res && "error" in res ? res.error ?? null : null);
          router.refresh();
        }}
      >
        <option value="">No staff access</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {msg && <span className="text-xs text-danger-600">{msg}</span>}
    </div>
  );
}
