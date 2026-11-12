import { db } from "@/lib/db";
import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { toPaise } from "@/lib/money";
import { csvResponse } from "@/lib/csv";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer export – needs the dedicated customers.export permission. Never includes password hashes or tokens. */
export async function GET() {
  const staff = await getStaff();
  if (!staff || !hasPermission(staff.permissions, "customers.export")) return new Response("Not authorised", { status: 403 });
  const users = await db.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "asc" },
    select: { name: true, email: true, phone: true, createdAt: true, isActive: true, marketingOptIn: true, orders: { where: { status: { not: "CANCELLED" } }, select: { amountPaid: true } } },
  });
  await audit({ actorId: staff.id, action: "export.customers", entity: "User", summary: `Exported ${users.length} customers` });
  return csvResponse(
    `driponza-customers-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Name", "Email", "Phone", "Joined", "Status", "Marketing opt-in", "Orders", "Paid (₹)"],
    users.map((u) => [u.name, u.email, u.phone ?? "", u.createdAt.toISOString().slice(0, 10), u.isActive ? "active" : "suspended", u.marketingOptIn ? "yes" : "no", u.orders.length, (u.orders.reduce((n, o) => n + toPaise(o.amountPaid), 0) / 100).toFixed(2)]),
  );
}
