/**
 * One-off update for an existing database: makes the text-free spice photo the first (card) image
 * of each imported product, keeping every other image after it. Safe to re-run.
 *   npx tsx scripts/use-clean-photos.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CLEAN_PHOTOS } from "./clean-photos";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  for (const [legacyId, url] of Object.entries(CLEAN_PHOTOS)) {
    const product = await db.product.findUnique({ where: { legacyId: Number(legacyId) }, include: { images: { orderBy: { position: "asc" } } } });
    if (!product) continue;
    let images = product.images;
    if (!images.some((i) => i.url === url)) {
      const created = await db.productImage.create({ data: { productId: product.id, url, alt: product.name.replace(/^DRIPONZA\s+/i, ""), position: -1 } });
      images = [created, ...images];
    }
    const ordered = [images.find((i) => i.url === url)!, ...images.filter((i) => i.url !== url)];
    await db.$transaction(ordered.map((img, position) => db.productImage.update({ where: { id: img.id }, data: { position } })));
    console.log(`${product.name}: ${ordered.length} image(s), main = ${url}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
