import { formatINR } from "@/lib/money";
import { monthLabel, type MonthRow } from "@/server/reports";

/** Simple accessible bar chart of net monthly revenue (server-rendered SVG). */
export function RevenueChart({ rows }: { rows: MonthRow[] }) {
  const max = Math.max(...rows.map((r) => r.net), 1);
  const W = 720;
  const H = 220;
  const pad = { top: 16, bottom: 28, left: 8 };
  const slot = (W - pad.left) / rows.length;
  const barW = Math.min(36, slot * 0.6);
  const total = rows.reduce((n, r) => n + r.net, 0);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Net revenue over the last ${rows.length} months, total ${formatINR(total)}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={pad.top + (H - pad.top - pad.bottom) * (1 - f)} y2={pad.top + (H - pad.top - pad.bottom) * (1 - f)} stroke="#efebdf" />
        ))}
        {rows.map((r, i) => {
          const h = ((H - pad.top - pad.bottom) * r.net) / max;
          const x = pad.left + i * slot + (slot - barW) / 2;
          const y = H - pad.bottom - Math.max(h, r.net > 0 ? 2 : 0);
          return (
            <g key={r.month}>
              <title>{`${monthLabel(r.month)}: ${formatINR(r.net)} net · ${r.orders} orders`}</title>
              <rect x={x} y={y} width={barW} height={H - pad.bottom - y} rx={6} fill={i === rows.length - 1 ? "#2e7d3a" : "#9fcf7e"} />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#69716a">
                {monthLabel(r.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-ink-500">Net revenue (paid orders minus refunds), Indian Standard Time.</figcaption>
    </figure>
  );
}
