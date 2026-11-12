/**
 * Imports the real product catalogue captured from https://driponza.xyz (api.php?action=products)
 * on 2026-11-11 and stored in _source/catalogue.json. Nothing here is invented:
 *  - price/offerPrice map to mrp/price (offer price becomes the selling price when lower)
 *  - the source has no stock figures → stock = SEED_STOCK (default 0) and the product is flagged for review
 * Safe to re-run: existing products (matched by legacy id) are left untouched.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CLEAN_PHOTOS } from "../scripts/clean-photos";

type SourceProduct = {
  id: number;
  name: string;
  category: string;
  weight: string;
  price: number;
  offerPrice: number;
  tag: string;
  featured: boolean;
  description: string;
  images: string[];
  active: boolean;
};

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const slugify = (s: string) =>
  s.toLowerCase().replace(/^driponza\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const REVIEW_NOTES: Record<number, string[]> = {
  19: ["Price ₹60 / 100 g looks low compared with the rest of the range – please confirm."],
  21: ["Source name says “Way Leaf” – probably a typo for “Bay Leaf”. Please confirm the product name."],
  22: ["Price ₹590 / 100 g looks high compared with the rest of the range – please confirm."],
};

async function main() {
  const file = path.join(process.cwd(), "_source", "catalogue.json");
  const source: SourceProduct[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const seedStock = Math.max(0, parseInt(process.env.SEED_STOCK ?? "0", 10) || 0);

  const whole = await db.category.upsert({
    where: { slug: "whole-spices" },
    update: {},
    create: {
      name: "Whole Spices",
      slug: "whole-spices",
      position: 0,
      description: "Carefully selected whole spices with rich aroma and authentic flavour.",
    },
  });
  // Present as a filter on the source site but contains no products yet – hidden on the storefront until it does.
  await db.category.upsert({
    where: { slug: "spice-powders" },
    update: {},
    create: { name: "Spice Powders", slug: "spice-powders", position: 1 },
  });

  let created = 0;
  for (const [index, p] of source.entries()) {
    const exists = await db.product.findUnique({ where: { legacyId: p.id } });
    if (exists) continue;

    const original = Number(p.price);
    const offer = Number(p.offerPrice);
    const hasOffer = offer > 0 && offer < original;
    const grams = parseInt(p.weight, 10);
    const notes = [
      "Imported from driponza.xyz. Stock quantity was not available on the source site – set real stock before selling.",
      ...(REVIEW_NOTES[p.id] ?? []),
    ];

    await db.product.create({
      data: {
        legacyId: p.id,
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        tag: p.tag || null,
        categoryId: whole.id,
        isActive: p.active,
        isFeatured: true, // all 8 shown on the homepage initially; Nutmeg was "featured" on the source
        featuredOrder: p.featured ? 0 : index + 1,
        needsReview: true,
        reviewNotes: notes.join("\n"),
        images: {
          // Main image = text-free spice photo (see scripts/clean-photos.ts), then the pack shot, then the rest.
          create: [...new Set([CLEAN_PHOTOS[p.id], ...p.images.map((src) => `/images/products/${path.basename(src)}`)].filter(Boolean))].map((url, i) => ({
            url,
            alt: `${p.name.replace(/^DRIPONZA\s+/i, "")} – image ${i + 1}`,
            position: i,
          })),
        },
        variants: {
          create: {
            label: p.weight,
            weightGrams: Number.isFinite(grams) ? grams : null,
            sku: `DZ-${p.id}-${p.weight.replace(/\s+/g, "").toUpperCase()}`,
            price: (hasOffer ? offer : original).toFixed(2),
            mrp: hasOffer ? original.toFixed(2) : null,
            stock: seedStock,
            movements: { create: { change: seedStock, stockAfter: seedStock, reason: "INITIAL", note: "Seed import" } },
          },
        },
      },
    });
    created++;
  }
  console.log(`Seed complete: ${created} product(s) created, ${source.length - created} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
