import Link from "next/link";
import { AdminHeader, Empty, PillTabs } from "@/components/admin/ui";
import { ReviewButtons } from "@/components/admin/StoreForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import type { ReviewStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("reviews.moderate");
  const { tab: t } = await searchParams;
  const tab = (["PENDING", "APPROVED", "REJECTED"].includes(t ?? "") ? t : "PENDING") as ReviewStatus;
  const [rows, counts, reported] = await Promise.all([
    db.review.findMany({ where: { status: tab }, orderBy: { createdAt: "desc" }, take: 200, include: { product: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } } }),
    db.review.groupBy({ by: ["status"], _count: true }),
    db.review.count({ where: { reports: { gt: 0 }, status: "APPROVED" } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <AdminHeader title="Reviews" description={`Only approved reviews appear on product pages. “Verified purchase” is set automatically when the reviewer has a delivered order for the product.${reported ? ` ${reported} approved review(s) were reported by shoppers.` : ""}`} />
      <PillTabs items={(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => ({ label: s === "PENDING" ? "To moderate" : s[0] + s.slice(1).toLowerCase(), count: n(s), href: `/admin/reviews?tab=${s}`, active: s === tab }))} />
      {rows.length ? (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 rounded-[22px] border border-[#eceee9] bg-white p-5">
              <div className="max-w-3xl text-sm">
                <p className="text-amber-600" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span className="text-cream-200">{"★".repeat(5 - r.rating)}</span></p>
                {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                <p className="mt-1 whitespace-pre-line text-ink-700">{r.body}</p>
                <p className="mt-2 text-xs text-ink-500">
                  <Link href={`/products/${r.product.slug}`} className="text-green-600 underline">{r.product.name}</Link> · {r.user.name} ({r.user.email}) · {formatDate(r.createdAt)}
                  {r.verified && " · verified purchase"}{r.reports ? ` · reported ${r.reports}×` : ""}
                </p>
              </div>
              <ReviewButtons id={r.id} status={r.status} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No reviews here.</Empty>
      )}
    </>
  );
}
