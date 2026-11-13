import crypto from "node:crypto";
import { db } from "@/lib/db";
import { expireUnpaidOrders } from "@/server/orders";
import { retryNotifications } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled maintenance. Vercel Cron sends "Authorization: Bearer $CRON_SECRET";
 * Coolify uses the same header via curl.
 *
 * Vercel's Hobby plan allows one cron run per day, so vercel.json schedules this
 * daily. Between runs, expired unpaid orders are also swept opportunistically:
 * before a checkout is quoted (so stale reservations can't block a real sale) and
 * after each admin page responds. On a plan that allows it, "30 * * * *" is better.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Not found", { status: 404 });
  }
  const expired = await expireUnpaidOrders();
  const retried = await retryNotifications();
  const now = new Date();
  const [buckets, sessions] = await Promise.all([
    db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return Response.json({ ok: true, expired, retried, cleaned: { rateLimitBuckets: buckets.count, sessions: sessions.count } });
}
