import { AdminHeader, Panel, Table } from "@/components/admin/ui";
import { InviteStaffForm, RoleCard, RoleForm } from "@/components/admin/StoreForms";
import { StaffRoleSelect } from "@/components/admin/CustomerActions";
import { StaffPasswordButton } from "@/components/admin/StaffPasswordButton";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { ensureSystemRoles } from "@/server/roles";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const me = await requirePermission("staff.manage");
  await ensureSystemRoles();
  const [roles, staff, logins] = await Promise.all([
    db.staffRole.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { users: true } } } }),
    db.user.findMany({ where: { role: "ADMIN" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, staffRoleId: true } }),
    db.session.findMany({ where: { user: { role: "ADMIN" }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, createdAt: true, ip: true, userAgent: true, user: { select: { name: true } } } }),
  ]);
  const permissions = Object.entries(PERMISSIONS);
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <AdminHeader title="Staff & roles" description="Permissions are checked on the server for every page and action. Role changes sign the person out so they apply immediately." />
      <Panel title="Staff" className="mb-6" actions={<InviteStaffForm roles={roleOptions} />}>
        <Table>
          <thead><tr><th>Name</th><th>Last login</th><th>Status</th><th>Role</th><th className="text-right">Password</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><p className="font-medium">{s.name}</p><p className="text-xs text-ink-500">{s.email}</p></td>
                <td className="text-ink-500">{s.lastLoginAt ? formatDate(s.lastLoginAt, true) : "—"}</td>
                <td className="text-xs">{s.isActive ? "Active" : "Suspended"}</td>
                <td>{s.id === me.id ? <span className="text-xs text-ink-500">{roles.find((r) => r.id === s.staffRoleId)?.name ?? "—"} (you)</span> : <StaffRoleSelect userId={s.id} current={s.staffRoleId} roles={roleOptions} />}</td>
                <td className="text-right"><StaffPasswordButton userId={s.id} name={s.name} email={s.email} isSelf={s.id === me.id} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <h2 className="mb-3 text-[15px] font-semibold">Roles</h2>
      <ul className="mb-6 grid gap-3">
        {roles.map((r) => <RoleCard key={r.id} role={r} permissions={permissions} users={r._count.users} editable />)}
      </ul>
      <Panel title="Create a custom role" className="mb-6"><RoleForm permissions={permissions} /></Panel>
      <Panel title="Active staff sessions">
        <ul className="space-y-1.5 text-xs">
          {logins.map((l) => <li key={l.id}>{l.user.name} · signed in {formatDate(l.createdAt, true)} · {l.ip ?? "unknown IP"} · <span className="text-ink-500">{l.userAgent?.slice(0, 80)}</span></li>)}
        </ul>
      </Panel>
    </>
  );
}
