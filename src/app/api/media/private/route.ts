import { db } from "@/lib/db";
import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { readStoredObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams private uploads (payment proofs, return photos) to staff who may review them. */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !["payments.verify", "returns.manage", "orders.view"].some((p) => hasPermission(staff.permissions, p as never))) {
    return new Response("Not found", { status: 404 });
  }
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key.startsWith("private/") || key.includes("..")) return new Response("Not found", { status: 404 });
  const asset = await db.mediaAsset.findUnique({ where: { key } });
  if (!asset?.isPrivate) return new Response("Not found", { status: 404 });
  const storageId = asset.provider === "blob" ? `blob:${asset.url}` : `${asset.provider}:${key}`;
  const file = await readStoredObject(storageId);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
}
