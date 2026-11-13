import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { csvResponse } from "@/lib/csv";
import { audit } from "@/server/audit";
import { buildReport, REPORTS } from "@/server/report-builder";
import { istDayStart } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ report: string }> }) {
  const { report } = await ctx.params;
  const def = REPORTS[report];
  const staff = await getStaff();
  if (!def || !staff || !hasPermission(staff.permissions, def.perm)) return new Response("Not authorised", { status: 403 });
  const url = new URL(req.url);
  const f = url.searchParams.get("from");
  const t = url.searchParams.get("to");
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const from = valid(f) ? new Date(`${f}T00:00:00+05:30`) : istDayStart(new Date(), -29);
  const to = valid(t) ? new Date(new Date(`${t}T00:00:00+05:30`).getTime() + 864e5) : new Date();
  const r = await buildReport(report, { from, to });
  await audit({ actorId: staff.id, action: "export.report", entity: "Report", entityId: report, summary: `Exported ${def.label} (${r.rows.length} rows)` });
  return csvResponse(`driponza-${report}-${from.toISOString().slice(0, 10)}.csv`, r.columns, r.totals ? [...r.rows, r.totals] : r.rows);
}
