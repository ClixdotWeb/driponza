import "server-only";
import { db } from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/permissions";

/** Creates the built-in roles if missing. Existing roles keep any edits staff made (except Super Admin, which always has "*"). */
export async function ensureSystemRoles() {
  for (const r of SYSTEM_ROLES) {
    await db.staffRole.upsert({
      where: { id: r.id },
      create: { id: r.id, name: r.name, description: r.description, permissions: r.permissions, isSystem: true },
      update: r.id === "role_super_admin" ? { permissions: ["*"], isSystem: true } : { isSystem: true },
    });
  }
}
