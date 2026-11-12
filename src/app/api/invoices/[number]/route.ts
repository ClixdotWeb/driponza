import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser, getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { hashGuestToken } from "@/server/orders";
import { renderInvoicePdf } from "@/server/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Invoice PDF for the order owner, a guest holding the order secret, or staff with orders.view. */
export async function GET(req: Request, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  const order = await db.order.findUnique({ where: { number: number.slice(0, 40) }, select: { id: true, userId: true, guestAccessHash: true, invoiceNumber: true } });
  if (!order?.invoiceNumber) return new Response("Not found", { status: 404 });
  const [user, staff] = await Promise.all([getCurrentUser(), getStaff()]);
  const k = new URL(req.url).searchParams.get("k") || (await cookies()).get(`dz_go_${number.slice(0, 40)}`)?.value;
  const allowed =
    (user && order.userId === user.id) ||
    (staff && hasPermission(staff.permissions, "orders.view")) ||
    (k && order.guestAccessHash && order.guestAccessHash === hashGuestToken(k));
  if (!allowed) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(order.id);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
