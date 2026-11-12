import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { uploadMedia } from "@/server/media";
import { audit } from "@/server/audit";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || !(hasPermission(staff.permissions, "media.manage") || hasPermission(staff.permissions, "products.edit")))
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  // CSRF: route handlers don't get Server Actions' built-in origin check, so verify it here.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const form = await req.formData();
  const productId = String(form.get("productId") ?? "");
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  if (files.length > 10) return NextResponse.json({ error: "Upload at most 10 images at a time" }, { status: 400 });

  const last = await db.productImage.findFirst({ where: { productId }, orderBy: { position: "desc" } });
  let position = (last?.position ?? -1) + 1;
  const errors: string[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${file.name.slice(0, 80)}: larger than ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB`);
      continue;
    }
    try {
      const stored = await uploadMedia(Buffer.from(await file.arrayBuffer()), "products", { alt: product.name, actorId: staff.id });
      await db.productImage.create({ data: { productId, url: stored.url, storageId: stored.storageId, alt: product.name, position: position++ } });
    } catch (err) {
      errors.push(`${file.name.slice(0, 80)}: ${err instanceof Error ? err.message : "upload failed"}`);
    }
  }
  await audit({ actorId: staff.id, action: "media.upload", entity: "Product", entityId: productId, summary: `Uploaded ${files.length - errors.length} image(s) to ${product.name}` });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: errors.length === 0, errors });
}
