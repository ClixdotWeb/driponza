import { Download } from "lucide-react";
import { AdminHeader, Empty, Panel, PillTabs, Table } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { buildReport, REPORTS } from "@/server/report-builder";
import { istDayStart } from "@/server/reports";

export const metadata = { title: "Reports" };
const PER_PAGE = 100;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ r?: string; from?: string; to?: string; page?: string }> }) {
  const staff = await requirePermission("reports.view");
  const sp = await searchParams;
  const allowed = Object.entries(REPORTS).filter(([, v]) => hasPermission(staff.permissions, v.perm));
  const name = allowed.some(([k]) => k === sp.r) ? sp.r! : allowed[0]?.[0];
  const from = sp.from ? new Date(`${sp.from}T00:00:00+05:30`) : istDayStart(new Date(), -29);
  const to = sp.to ? new Date(new Date(`${sp.to}T00:00:00+05:30`).getTime() + 864e5) : new Date();
  const report = name ? await buildReport(name, { from, to }) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = report?.rows.slice((page - 1) * PER_PAGE, page * PER_PAGE) ?? [];
  const pages = Math.ceil((report?.rows.length ?? 0) / PER_PAGE);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(name ? { r: name } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...extra }).toString();

  return (
    <>
      <AdminHeader
        title="Reports"
        description="Every figure is calculated live from orders, the payment ledger and inventory records."
        actions={
          <form className="flex flex-wrap items-center gap-2 text-[13px]">
            <input type="hidden" name="r" value={name} />
            <input type="date" name="from" defaultValue={sp.from ?? from.toISOString().slice(0, 10)} className="field-input w-auto py-1.5 text-[13px]" aria-label="From" />
            <input type="date" name="to" defaultValue={sp.to} className="field-input w-auto py-1.5 text-[13px]" aria-label="To" />
            <button className="btn btn-sm btn-outline text-forest-800">Apply</button>
            {name && <a href={`/api/admin/reports/${name}?${qs({})}`} className="btn btn-sm btn-primary"><Download className="size-3.5" /> CSV</a>}
          </form>
        }
      />
      <PillTabs items={allowed.map(([k, v]) => ({ label: v.label, href: `/admin/reports?${new URLSearchParams({ r: k, ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) })}`, active: k === name }))} />
      {report && (
        <Panel title={report.title}>
          <p className="mb-4 text-xs text-ink-500">{report.description}</p>
          {report.rows.length ? (
            <>
              <Table>
                <thead><tr>{report.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === "number" || /^₹|^-?₹/.test(String(c)) ? "tabular-nums" : ""}>{c}</td>)}</tr>)}
                  {report.totals && page === pages && <tr className="font-semibold">{report.totals.map((c, j) => <td key={j} className="tabular-nums">{c}</td>)}</tr>}
                </tbody>
              </Table>
              {pages > 1 && (
                <div className="mt-3 flex justify-end gap-2 text-sm">
                  {page > 1 && <a className="btn btn-sm btn-outline text-forest-800" href={`/admin/reports?${qs({ page: String(page - 1) })}`}>Previous</a>}
                  <span className="text-ink-500">Page {page} of {pages}</span>
                  {page < pages && <a className="btn btn-sm btn-outline text-forest-800" href={`/admin/reports?${qs({ page: String(page + 1) })}`}>Next</a>}
                </div>
              )}
            </>
          ) : (
            <Empty>No data for this range.</Empty>
          )}
        </Panel>
      )}
    </>
  );
}
