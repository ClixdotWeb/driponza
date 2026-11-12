import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";

/**
 * Fixed-window limiter stored in PostgreSQL, so limits hold across serverless instances / replicas.
 * One atomic upsert per call. Fails open (allows) if the database is unreachable, so a DB hiccup never locks customers out.
 */
export async function rateLimit(action: string, limit: number, windowMs: number) {
  const ip = clientIp(await headers());
  const key = `${action}:${ip}`.slice(0, 200);
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    if (row && row.count > limit) return { ok: false as const, retryAfter: Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000) };
  } catch (err) {
    console.error("[rate-limit]", err);
  }
  return { ok: true as const };
}
