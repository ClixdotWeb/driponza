import { AdminHeader, Panel } from "@/components/admin/ui";
import { CouponForm, CouponRow } from "@/components/admin/Forms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatINR, toPaise } from "@/lib/money";

export const metadata = { title: "Coupons" };

const isoDate = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : "");

export default async function CouponsPage() {
  await requirePermission("coupons.manage");
  const [coupons, products, categories] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { usages: true } } } }),
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  const scope = { products, categories };
  const nameOf = (ids: string[], list: Array<{ id: string; name: string }>) => ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean).join(", ");

  return (
    <>
      <AdminHeader title="Coupons & discounts" description="Validated on the server at checkout. A use is counted when the order is placed and released again if it is cancelled." />
      <Panel title="New coupon" className="mb-6">
        <CouponForm scope={scope} />
      </Panel>
      <ul className="grid gap-3">
        {coupons.map((c) => (
          <CouponRow
            key={c.id}
            scope={scope}
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
              firstOrderOnly: c.firstOrderOnly,
              productIds: c.productIds,
              categoryIds: c.categoryIds,
            }}
            summary={
              <div>
                <p className="font-medium">
                  {c.code} <span className={c.isActive ? "text-xs text-green-600" : "text-xs text-ink-500"}>{c.isActive ? "Active" : "Inactive"}</span>
                </p>
                <p className="text-sm text-ink-700">
                  {c.type === "PERCENT" ? `${Number(c.value)}% off` : c.type === "FIXED" ? `${formatINR(toPaise(c.value))} off` : "Free shipping"}
                  {c.minSubtotal && ` · min ${formatINR(toPaise(c.minSubtotal))}`}
                  {c.maxDiscount && ` · max ${formatINR(toPaise(c.maxDiscount))}`}
                  {c.firstOrderOnly && " · first order only"}
                </p>
                {(c.productIds.length > 0 || c.categoryIds.length > 0) && (
                  <p className="text-xs text-ink-500">Applies to: {[nameOf(c.productIds, products), nameOf(c.categoryIds, categories)].filter(Boolean).join(" · ")}</p>
                )}
                <p className="text-xs text-ink-500">
                  Used {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} times ({c._count.usages} recorded orders){c.endsAt ? ` · ends ${isoDate(c.endsAt)}` : ""}
                </p>
              </div>
            }
          />
        ))}
      </ul>
    </>
  );
}
