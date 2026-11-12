import "server-only";
import { db } from "@/lib/db";
import { deleteStoredImage, storeImage } from "@/lib/storage";

/** Stores an image and records its metadata. The DB holds only metadata + object key, never the bytes. */
export async function uploadMedia(buf: Buffer, folder: string, opts: { isPrivate?: boolean; alt?: string | null; actorId?: string | null } = {}) {
  const stored = await storeImage(buf, folder, { isPrivate: opts.isPrivate });
  await db.mediaAsset.create({
    data: {
      key: stored.key,
      // Provider URL (for Blob this is needed to read private files back; it is never sent to customers).
      url: stored.provider === "blob" ? stored.storageId.slice(5) : stored.url,
      provider: stored.provider,
      mime: stored.mime,
      sizeBytes: stored.sizeBytes,
      width: stored.width,
      height: stored.height,
      alt: opts.alt ?? null,
      folder,
      isPrivate: Boolean(opts.isPrivate),
      createdById: opts.actorId ?? null,
    },
  });
  return stored;
}

/** How many records still point at this stored object (product images, categories, transfers, returns). */
export async function mediaReferenceCount(storageId: string, url?: string | null) {
  const [images, categories, transfers, returns, orderSnapshots] = await Promise.all([
    db.productImage.count({ where: { storageId } }),
    url ? db.category.count({ where: { imageUrl: url } }) : 0,
    db.bankTransferSubmission.count({ where: { proofKey: storageId } }),
    db.returnRequest.count({ where: { imageKeys: { has: storageId } } }),
    // Past orders keep the product photo URL in their snapshot – keep the file so order history stays intact.
    url ? db.orderItem.count({ where: { imageUrl: url } }) : 0,
  ]);
  return images + categories + transfers + returns + orderSnapshots;
}

/** Deletes the stored file only when nothing references it any more (prevents breaking shared images). */
export async function releaseMedia(storageId: string | null | undefined, url?: string | null) {
  if (!storageId) return false;
  if ((await mediaReferenceCount(storageId, url)) > 0) return false;
  await deleteStoredImage(storageId);
  const key = storageId.replace(/^(s3|local):/, "");
  await db.mediaAsset.deleteMany({ where: { OR: [{ key }, ...(url ? [{ url }] : [])] } });
  return true;
}
