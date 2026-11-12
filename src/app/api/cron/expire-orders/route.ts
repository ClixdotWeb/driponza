import crypto from "node:crypto";
import { db } from "@/lib/db";
import { expireUnpaidOrders } from "@/server/orders";
import { retryNotifications } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hourly maintenance. Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; Coolify uses the same header via curl. */
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
