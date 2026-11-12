import Link from "next/link";
import { AdminHeader, Empty, PillTabs, Tray } from "@/components/admin/ui";
import { TicketForm } from "@/components/admin/StoreForms";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import type { TicketStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string }> }) {
  await requirePermission("support.manage");
  const sp = await searchParams;
  const tab = (["OPEN", "PENDING", "CLOSED"].includes(sp.tab ?? "") ? sp.tab : "OPEN") as TicketStatus;
  const [rows, counts] = await Promise.all([
    db.supportTicket.findMany({ where: sp.id ? { id: sp.id } : { status: tab }, orderBy: { createdAt: "asc" }, take: 100 }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const orders = await db.order.findMany({ where: { number: { in: rows.map((r) => r.orderNumber).filter((x): x is string => Boolean(x)) } }, select: { id: true, number: true } });
  return (
    <>
      <AdminHeader title="Support" description="Messages from the contact form. Replies are emailed to the customer (when SMTP is configured)." />
      <PillTabs items={(["OPEN", "PENDING", "CLOSED"] as const).map((s) => ({ label: s === "PENDING" ? "Waiting on customer" : s[0] + s.slice(1).toLowerCase(), count: n(s), href: `/admin/support?tab=${s}`, active: !sp.id && s === tab }))} />
      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((t) => {
            const o = orders.find((x) => x.number === t.orderNumber);
            return (
              <Tray key={t.id}>
                <div className="rounded-2xl bg-white p-4 text-sm">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-ink-500">{t.name} · {t.email}{t.phone ? ` · ${t.phone}` : ""} · {formatDate(t.createdAt, true)}</p>
                  {t.orderNumber && <p className="text-xs">Order: {o ? <Link href={`/admin/orders/${o.id}`} className="text-green-600 underline">{t.orderNumber}</Link> : t.orderNumber}</p>}
                  <p className="mt-2 whitespace-pre-line text-ink-700">{t.message}</p>
                </div>
                <div className="mt-3 rounded-2xl bg-white p-4"><TicketForm id={t.id} status={t.status} note={t.staffNote ?? ""} /></div>
              </Tray>
            );
          })}
        </div>
      ) : (
        <Empty>No tickets here.</Empty>
      )}
    </>
  );
}
