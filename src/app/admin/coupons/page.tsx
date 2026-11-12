import { AdminHeader, Panel } from "@/components/admin/ui";
import { CouponForm, CouponRow } from "@/components/admin/Forms";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";

export const metadata = { title: "Coupons" };

const isoDate = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : "");

export default async function CouponsPage() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <AdminHeader title="Coupons & discounts" description="Discounts are validated on the server at checkout. Usage counts increase only when an order is paid (or placed as COD)." />
      <Panel title="New coupon" className="mb-6">
        <CouponForm />
      </Panel>
      <ul className="grid gap-3">
        {coupons.map((c) => (
          <CouponRow
            key={c.id}
            coupon={{
              id: c.id,
              code: c.code,
              description: c.description,
              type: c.type,
              value: c.value.toString(),
              minSubtotal: c.minSubtotal?.toString() ?? "",
              maxDiscount: c.maxDiscount?.toString() ?? "",
              startsAt: isoDate(c.startsAt),
              endsAt: isoDate(c.endsAt),
              usageLimit: c.usageLimit?.toString() ?? "",
              perUserLimit: c.perUserLimit?.toString() ?? "",
              isActive: c.isActive,
            }}
            summary={
              <div>
                <p className="font-medium">
                  {c.code}{" "}
                  <span className={c.isActive ? "text-xs text-green-600" : "text-xs text-ink-500"}>{c.isActive ? "Active" : "Inactive"}</span>
                </p>
                <p className="text-sm text-ink-700">
                  {c.type === "PERCENT" ? `${Number(c.value)}% off` : `${formatINR(toPaise(c.value))} off`}
                  {c.minSubtotal && ` · min ${formatINR(toPaise(c.minSubtotal))}`}
                  {c.maxDiscount && ` · max ${formatINR(toPaise(c.maxDiscount))}`}
                </p>
                <p className="text-xs text-ink-500">
                  Used {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} times{c.endsAt ? ` · ends ${isoDate(c.endsAt)}` : ""}
                </p>
              </div>
            }
          />
        ))}
      </ul>
    </>
  );
}
