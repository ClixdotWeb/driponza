import "server-only";
import { headers } from "next/headers";
import { clientIp } from "@/lib/auth/session";

// Fixed-window in-memory limiter. Suitable for a single Coolify instance;
// swap for Redis if you scale to multiple replicas.
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(action: string, limit: number, windowMs: number) {
  const ip = clientIp(await headers());
  const key = `${action}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return { ok: true as const };
  }
  bucket.count++;
  if (bucket.count > limit) return { ok: false as const, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true as const };
}
