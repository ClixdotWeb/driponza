import fs from "node:fs/promises";
import path from "node:path";
import { MIME_BY_EXT, uploadDir } from "@/lib/storage";

export const runtime = "nodejs";

/** Serves locally stored uploads (used when Cloudinary isn't configured). */
export async function GET(_: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  // Private uploads are only served through the permission-checked /api/media/private route.
  if (parts[0] === "private") return new Response("Not found", { status: 404 });
  const root = uploadDir();
  const full = path.resolve(/* turbopackIgnore: true */ root, ...parts);
  if (!full.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  const ext = path.extname(full).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const file = await fs.readFile(full);
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
