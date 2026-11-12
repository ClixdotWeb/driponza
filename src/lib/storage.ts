import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del as blobDel, put as blobPut } from "@vercel/blob";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SIGNATURES: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { ext: "avif", mime: "image/avif", test: (b) => b.subarray(4, 12).toString() === "ftypavif" },
];

/** Detects the real file type from its bytes – the browser-supplied MIME type is not trusted. */
export function detectImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(SIGNATURES.map((s) => [s.ext, s.mime]));

export const cloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

/** Vercel Blob – set automatically when a Blob store is connected to the Vercel project. */
export const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function storageMode(): "blob" | "cloudinary" | "local" {
  return blobConfigured() ? "blob" : cloudinaryConfigured() ? "cloudinary" : "local";
}

export function uploadDir() {
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
}

function cloudinarySign(params: Record<string, string>) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + process.env.CLOUDINARY_API_SECRET).digest("hex");
}

export async function storeImage(buf: Buffer, folder = "products"): Promise<{ url: string; storageId: string }> {
  const kind = detectImage(buf);
  if (!kind) throw new Error("Only JPEG, PNG, WebP or AVIF images are allowed");
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 8 MB");

  if (blobConfigured()) {
    const name = `${folder}/${crypto.randomBytes(16).toString("hex")}.${kind.ext}`;
    const res = await blobPut(name, buf, { access: "public", contentType: kind.mime, addRandomSuffix: false });
    return { url: res.url, storageId: `blob:${res.url}` };
  }

  if (process.env.VERCEL) throw new Error("Image storage isn't set up yet — connect a Vercel Blob store (or Cloudinary) to enable uploads");

  if (cloudinaryConfigured()) {
    const params = { folder: `driponza/${folder}`, timestamp: Math.floor(Date.now() / 1000).toString() };
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: kind.mime }));
    form.append("api_key", process.env.CLOUDINARY_API_KEY!);
    form.append("timestamp", params.timestamp);
    form.append("folder", params.folder);
    form.append("signature", cloudinarySign(params));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message: string } };
    if (!res.ok || !json.secure_url) throw new Error(json.error?.message || "Cloudinary upload failed");
    return { url: json.secure_url, storageId: `cloudinary:${json.public_id}` };
  }

  const name = `${crypto.randomBytes(16).toString("hex")}.${kind.ext}`;
  const dir = path.join(/* turbopackIgnore: true */ uploadDir(), folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(/* turbopackIgnore: true */ dir, name), buf);
  return { url: `/media/${folder}/${name}`, storageId: `local:${folder}/${name}` };
}

export async function deleteStoredImage(storageId: string | null | undefined) {
  if (!storageId) return;
  try {
    if (storageId.startsWith("blob:") && blobConfigured()) {
      await blobDel(storageId.slice(5));
    } else if (storageId.startsWith("local:")) {
      const full = path.resolve(/* turbopackIgnore: true */ uploadDir(), storageId.slice(6));
      if (full.startsWith(uploadDir() + path.sep)) await fs.unlink(full);
    } else if (storageId.startsWith("cloudinary:") && cloudinaryConfigured()) {
      const params = { public_id: storageId.slice(11), timestamp: Math.floor(Date.now() / 1000).toString() };
      const form = new FormData();
      form.append("public_id", params.public_id);
      form.append("api_key", process.env.CLOUDINARY_API_KEY!);
      form.append("timestamp", params.timestamp);
      form.append("signature", cloudinarySign(params));
      await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: "POST", body: form });
    }
  } catch (err) {
    console.error("[storage:delete]", err);
  }
}
