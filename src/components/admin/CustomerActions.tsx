"use client";

import { useRouter } from "next/navigation";
import { setCustomerActiveAction, setUserRoleAction } from "@/server/actions/admin-orders";

export function CustomerActions({ userId, active, role }: { userId: string; active: boolean; role: "CUSTOMER" | "ADMIN" }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-1">
      <button
        className="btn btn-sm text-xs hover:bg-cream-100"
        onClick={async () => {
          if (!confirm(active ? "Disable this account? They will be signed out." : "Re-enable this account?")) return;
          await setCustomerActiveAction(userId, !active);
          router.refresh();
        }}
      >
        {active ? "Disable" : "Enable"}
      </button>
      <button
        className="btn btn-sm text-xs hover:bg-cream-100"
        onClick={async () => {
          const next = role === "ADMIN" ? "CUSTOMER" : "ADMIN";
          if (!confirm(next === "ADMIN" ? "Give this person full admin access?" : "Remove admin access?")) return;
          await setUserRoleAction(userId, next);
          router.refresh();
        }}
      >
        {role === "ADMIN" ? "Remove admin" : "Make admin"}
      </button>
    </div>
  );
}
