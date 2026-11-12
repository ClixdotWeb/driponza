import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { del as blobDel, put as blobPut } from "@vercel/blob";
import sharp from "sharp";

// ─────────────────────────── Limits & validation ───────────────────────────

const envMax = Number(process.env.S3_UPLOAD_MAX_SIZE);
export const MAX_UPLOAD_BYTES = Number.isFinite(envMax) && envMax > 0 ? envMax : 8 * 1024 * 1024;
export const MAX_DIMENSION = 2400; // longest edge after processing
const MAX_INPUT_PIXELS = 40_000_000; // rejects decompression bombs

const SIGNATURES: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { ext: "avif", mime: "image/avif", test: (b) => b.subarray(4, 12).toString() === "ftypavif" },
];

/** Detects the real file type from its bytes – the browser-supplied MIME type and filename are never trusted. */
export function detectImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(SIGNATURES.map((s) => [s.ext, s.mime]));

export class UploadError extends Error {}

/**
 * Validates and re-encodes an image: verifies the signature, decodes it fully (corrupt files fail),
 * applies EXIF orientation then strips all metadata (GPS etc.), caps dimensions and converts to WebP.
 * Re-encoding also neutralises any non-image payload hidden in the file.
 */
export async function processImage(buf: Buffer) {
  if (buf.length === 0) throw new UploadError("The file is empty.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError(`Image is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  if (!detectImage(buf)) throw new UploadError("Only JPEG, PNG, WebP or AVIF images are allowed.");
  try {
    const img = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const out = await img
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height, mime: "image/webp", ext: "webp" };
  } catch {
    throw new UploadError("This image is corrupted or too large to process.");
  }
}

// ─────────────────────────── Providers ───────────────────────────

export const s3Configured = () =>
  Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PUBLIC_URL);
export const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const cloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export type StorageProvider = "s3" | "blob" | "cloudinary" | "local";

/** Coolify MinIO (S3) is preferred whenever configured. */
export function storageMode(): StorageProvider {
  if (s3Configured()) return "s3";
  if (blobConfigured()) return "blob";
  if (cloudinaryConfigured()) return "cloudinary";
  return "local";
}

export function uploadDir() {
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
}

let s3: AwsClient | null = null;
function s3Client() {
  s3 ??= new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    region: process.env.S3_REGION || "us-east-1",
    service: "s3",
  });
  return s3;
}

/** Path-style (MinIO default) or virtual-host style object URL for API calls. */
function s3ObjectUrl(key: string) {
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
  const bucket = process.env.S3_BUCKET!;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  if (process.env.S3_FORCE_PATH_STYLE !== "false") return `${endpoint}/${bucket}/${encoded}`;
  const u = new URL(endpoint);
  return `${u.protocol}//${bucket}.${u.host}/${encoded}`;
}

function cloudinarySign(params: Record<string, string>) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + process.env.CLOUDINARY_API_SECRET).digest("hex");
}

export type StoredObject = { url: string; storageId: string; key: string; provider: StorageProvider; mime: string; sizeBytes: number; width: number; height: number };

/**
 * Validates, processes and stores an image. Keys are random (user filenames are ignored).
 * Private objects (payment proofs, return photos) go under "private/" and are never given a public URL –
 * they are served only through the permission-checked /api/media/private route.
 */
export async function storeImage(buf: Buffer, folder = "products", opts: { isPrivate?: boolean } = {}): Promise<StoredObject> {
  const img = await processImage(buf);
  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "").replace(/^\/+|\/+$/g, "") || "misc";
  const prefix = opts.isPrivate && !safeFolder.startsWith("private/") ? `private/${safeFolder}` : safeFolder;
  const key = `${prefix}/${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(16).toString("hex")}.${img.ext}`;
  const base = { key, mime: img.mime, sizeBytes: img.data.length, width: img.width, height: img.height };
  const isPrivate = key.startsWith("private/");

  const mode = storageMode();
  if (mode === "s3") {
    const res = await s3Client().fetch(s3ObjectUrl(key), {
      method: "PUT",
      body: new Uint8Array(img.data),
      headers: { "Content-Type": img.mime, "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new UploadError(`Image storage rejected the upload (${res.status}).`);
    const url = isPrivate ? `/api/media/private?key=${encodeURIComponent(key)}` : `${process.env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
    return { ...base, url, storageId: `s3:${key}`, provider: "s3" };
  }

  if (mode === "blob") {
    // Vercel Blob URLs are public but unguessable (128-bit random key); private ones are still only linked via the guarded route.
    const res = await blobPut(key, img.data, { access: "public", contentType: img.mime, addRandomSuffix: false });
    const url = isPrivate ? `/api/media/private?key=${encodeURIComponent(key)}` : res.url;
    return { ...base, url, storageId: `blob:${res.url}`, provider: "blob" };
  }

  if (process.env.VERCEL) throw new UploadError("Image storage isn't set up yet — configure Coolify MinIO (S3_*) or a Vercel Blob store.");

  if (mode === "cloudinary") {
    if (isPrivate) throw new UploadError("Private uploads are not supported on Cloudinary – configure S3 storage.");
    const params = { folder: `driponza/${safeFolder}`, timestamp: Math.floor(Date.now() / 1000).toString() };
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(img.data)], { type: img.mime }));
    form.append("api_key", process.env.CLOUDINARY_API_KEY!);
    form.append("timestamp", params.timestamp);
    form.append("folder", params.folder);
    form.append("signature", cloudinarySign(params));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
    const json = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message: string } };
    if (!res.ok || !json.secure_url) throw new UploadError(json.error?.message || "Cloudinary upload failed");
    return { ...base, url: json.secure_url, storageId: `cloudinary:${json.public_id}`, provider: "cloudinary" };
  }

  const full = path.join(/* turbopackIgnore: true */ uploadDir(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, img.data);
  const url = isPrivate ? `/api/media/private?key=${encodeURIComponent(key)}` : `/media/${key}`;
  return { ...base, url, storageId: `local:${key}`, provider: "local" };
}

/** Reads a stored object's bytes (used to stream private files to authorised staff). */
export async function readStoredObject(storageId: string): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    if (storageId.startsWith("s3:") && s3Configured()) {
      const res = await s3Client().fetch(s3ObjectUrl(storageId.slice(3)));
      if (!res.ok) return null;
      return { data: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "application/octet-stream" };
    }
    if (storageId.startsWith("blob:")) {
      const res = await fetch(storageId.slice(5));
      if (!res.ok) return null;
      return { data: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "application/octet-stream" };
    }
    if (storageId.startsWith("local:")) {
      const full = path.resolve(/* turbopackIgnore: true */ uploadDir(), storageId.slice(6));
      if (!full.startsWith(uploadDir() + path.sep)) return null;
      const ext = path.extname(full).slice(1).toLowerCase();
      return { data: new Uint8Array(await fs.readFile(full)), mime: MIME_BY_EXT[ext] ?? "application/octet-stream" };
    }
  } catch (err) {
    console.error("[storage:read]", err);
  }
  return null;
}

export async function deleteStoredImage(storageId: string | null | undefined) {
  if (!storageId) return;
  try {
    if (storageId.startsWith("s3:") && s3Configured()) {
      await s3Client().fetch(s3ObjectUrl(storageId.slice(3)), { method: "DELETE" });
    } else if (storageId.startsWith("blob:") && blobConfigured()) {
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
