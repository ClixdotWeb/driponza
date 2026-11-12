import { AdminHeader, Panel } from "@/components/admin/ui";
import { ZoneForm, ZoneRow } from "@/components/admin/StoreForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { INDIAN_STATES } from "@/server/validation";

export const metadata = { title: "Shipping" };
const r = (p: number | null) => (p === null ? "" : (p / 100).toString());

export default async function ShippingPage() {
  await requirePermission("settings.manage");
  const zones = await db.shippingZone.findMany({ orderBy: { position: "asc" } });
  const states = [...INDIAN_STATES];
  return (
    <>
      <AdminHeader
        title="Shipping zones"
        description="A delivery PIN uses the zone with the longest matching PIN prefix, then a zone listing its state, then a zone with no PINs or states (catch-all). PINs that match no zone can't be delivered to. With no zones at all, the default flat rate in Settings applies to all of India."
      />
      <Panel title="Add a zone" className="mb-6"><ZoneForm states={states} /></Panel>
      {zones.length ? (
        <ul className="grid gap-3">
          {zones.map((z) => (
            <ZoneRow
              key={z.id}
              states={states}
              zone={{ id: z.id, name: z.name, pincodePrefixes: z.pincodePrefixes, states: z.states, rate: r(z.ratePaise), freeAbove: r(z.freeAbovePaise), codAllowed: z.codAllowed, codCharge: r(z.codChargePaise), minDays: z.minDays, maxDays: z.maxDays, position: z.position, isActive: z.isActive }}
              summary={
                <div className={z.isActive ? "" : "opacity-60"}>
                  <p className="font-medium">{z.name} {!z.isActive && <span className="text-xs text-ink-500">(inactive)</span>}</p>
                  <p className="text-sm text-ink-700">
                    {formatINR(z.ratePaise)}{z.freeAbovePaise !== null ? ` · free above ${formatINR(z.freeAbovePaise)}` : ""} · {z.minDays}–{z.maxDays} days · {z.codAllowed ? `COD ${z.codChargePaise ? `+${formatINR(z.codChargePaise)}` : "free"}` : "no COD"}
                  </p>
                  <p className="text-xs text-ink-500">
                    {z.pincodePrefixes.length ? `PINs ${z.pincodePrefixes.join(", ")}` : ""}{z.pincodePrefixes.length && z.states.length ? " · " : ""}{z.states.join(", ")}{!z.pincodePrefixes.length && !z.states.length ? "Catch-all (rest of India)" : ""}
                  </p>
                </div>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-[22px] border border-dashed border-[#e2e5df] bg-white p-8 text-center text-sm text-ink-500">No zones yet – the default flat rate from Settings is used for every PIN code.</p>
      )}
    </>
  );
}
