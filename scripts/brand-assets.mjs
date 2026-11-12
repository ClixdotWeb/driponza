// Re-colours the original Driponza logo PNGs (lime, transparent) into brand colours
// and copies source product photos into /public. Run: npm run brand:assets
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SRC = "_source/images";
const OUT = "public";
const colours = { green: "#2E7D3A", forest: "#123D22", ivory: "#F8F6EF" };

async function tint(input, output, hex) {
  const img = sharp(input).ensureAlpha().trim();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  await sharp(data, { raw: info }).png().toFile(output);
  return info;
}

await fs.mkdir(`${OUT}/brand`, { recursive: true });
await fs.mkdir(`${OUT}/images/products`, { recursive: true });

for (const [name, hex] of Object.entries(colours)) {
  const w = await tint(`${SRC}/brand/word_mark_logo.png`, `${OUT}/brand/wordmark-${name}.png`, hex);
  const m = await tint(`${SRC}/brand/LOGO_BG.png`, `${OUT}/brand/mark-${name}.png`, hex);
  console.log(name, "wordmark", w.width, "x", w.height, "mark", m.width, "x", m.height);
}

// App icon: green mark on ivory
const mark = await sharp(`${OUT}/brand/mark-green.png`).resize(380, 380, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
const icon = sharp({ create: { width: 512, height: 512, channels: 4, background: colours.ivory } }).composite([{ input: mark, gravity: "center" }]);
const iconPng = await icon.png().toBuffer();
await fs.writeFile("src/app/icon.png", iconPng);
await sharp(iconPng).resize(180, 180).png().toFile("src/app/apple-icon.png");

for (const f of await fs.readdir(`${SRC}/products`)) {
  await sharp(`${SRC}/products/${f}`).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(`${OUT}/images/products/${f}`);
}
await sharp(`${SRC}/brand/about.jpeg`).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(`${OUT}/brand/story.jpg`);
console.log("done");
