import { AdminHeader, Empty, Pager, Table } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audit log" };
const PER_PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 80);
  const where = q ? { OR: [{ summary: { contains: q, mode: "insensitive" as const } }, { action: { contains: q } }, { actor: { email: { contains: q, mode: "insensitive" as const } } }] } : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return (
    <>
      <AdminHeader title="Audit log" description="Every sensitive staff action: payment verification, refunds, status changes, settings, roles, exports." />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search action, summary or staff email" className="field-input w-80 py-2" aria-label="Search audit log" />
        <button className="btn btn-outline btn-sm text-forest-800">Search</button>
      </form>
      {rows.length ? (
        <>
          <Table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Summary</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-ink-500">{formatDate(r.createdAt, true)}</td>
                  <td>{r.actor ? r.actor.name : <span className="text-ink-500">system</span>}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td>{r.summary}</td>
                  <td className="text-xs text-ink-500">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pages={Math.ceil(total / PER_PAGE)} href={(p) => `/admin/audit?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
        </>
      ) : (
        <Empty>No audit entries.</Empty>
      )}
    </>
  );
}
