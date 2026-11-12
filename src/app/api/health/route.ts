import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Used by the Docker / Coolify health check. Reports only up/down – no configuration details. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
