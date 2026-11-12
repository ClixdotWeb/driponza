import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";

// All defaults below are taken from the existing driponza.xyz site or the supplied address.
// Admins edit them in /admin/content without code changes.

export const contactSchema = z.object({
  phone: z.string().max(40),
  whatsapp: z.string().regex(/^\d{10,15}$/, "Digits only, with country code"),
  email: z.string().email(),
  website: z.string().max(120),
  addressLines: z.array(z.string().max(120)).max(8),
  mapUrl: z.string().max(500),
  instagram: z.string().max(300),
  facebook: z.string().max(300),
  youtube: z.string().max(300),
});

export const contentSchema = z.object({
  announcement: z.string().max(160),
  heroEyebrow: z.string().max(60),
  heroLine1: z.string().max(40),
  heroLine2: z.string().max(40),
  heroText: z.string().max(300),
  statement: z.string().max(500),
  storyTitle: z.string().max(120),
  storyText: z.string().max(1200),
  ctaTitle: z.string().max(120),
  ctaText: z.string().max(300),
  annotations: z.array(z.string().max(40)).length(3),
});

export const commerceSchema = z.object({
  shippingFlatPaise: z.number().int().min(0).max(1_000_000),
  freeShippingAbovePaise: z.number().int().min(0).max(100_000_000).nullable(),
  codEnabled: z.boolean(),
  whatsappOrdering: z.boolean(),
  shippingConfigured: z.boolean(),
});

export const policiesSchema = z.object({
  privacy: z.string().max(20000),
  terms: z.string().max(20000),
  shipping: z.string().max(20000),
  returns: z.string().max(20000),
});

export const DEFAULTS = {
  contact: {
    phone: "+91 85939 41385",
    whatsapp: "919946717137",
    email: "driponzatrading@gmail.com",
    website: "www.driponzatrading.com",
    addressLines: ["60/5161, Kedar Tower", "Puthiyapalam, Chalapuram", "Kozhikode, Kerala 673002", "India"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Kedar+Tower+Puthiyapalam+Chalapuram+Kozhikode+673002",
    instagram: "",
    facebook: "",
    youtube: "",
  },
  content: {
    announcement: "Pure Spices. Bold Flavour. — Naturally selected, carefully packed",
    heroEyebrow: "Nurture • Grow • Thrive",
    heroLine1: "Bring home the",
    heroLine2: "real taste of nature.",
    heroText:
      "Discover carefully selected spices with rich aroma, authentic flavour and uncompromising quality. Make every meal memorable with Driponza.",
    statement:
      "We believe the right spice can transform an ordinary dish into something extraordinary. From fragrant cardamom and cloves to warm cassia cinnamon, mace, nutmeg and bold black pepper — carefully selected, authentically flavoured and thoughtfully packed.",
    storyTitle: "Good food begins with good ingredients.",
    storyText:
      "At Driponza, we believe that the right spice can transform an ordinary dish into something extraordinary. We focus on carefully selected ingredients, authentic taste and thoughtful packaging.",
    ctaTitle: "Your kitchen deserves the good stuff.",
    ctaText: "Choose your favourites and bring home the real taste of nature.",
    annotations: ["A touch of aroma", "Bold & fresh", "Packed with care"],
  },
  commerce: {
    shippingFlatPaise: 0,
    freeShippingAbovePaise: null as number | null,
    codEnabled: false,
    whatsappOrdering: true,
    shippingConfigured: false,
  },
  policies: { privacy: "", terms: "", shipping: "", returns: "" },
};

const schemas = { contact: contactSchema, content: contentSchema, commerce: commerceSchema, policies: policiesSchema };
export type SettingKey = keyof typeof schemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof schemas)[K]> };

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(schemas) } } });
  const out = structuredClone(DEFAULTS) as Settings;
  for (const row of rows) {
    const key = row.key as SettingKey;
    if (!(key in schemas)) continue;
    const merged = { ...DEFAULTS[key], ...(row.value as object) };
    const parsed = schemas[key].safeParse(merged);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
});

export async function saveSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  const data = schemas[key].parse(value) as object;
  await db.setting.upsert({ where: { key }, create: { key, value: data }, update: { value: data } });
}

export function shippingFor(subtotalPaise: number, commerce: Settings["commerce"]) {
  if (subtotalPaise <= 0) return 0;
  if (commerce.freeShippingAbovePaise !== null && subtotalPaise >= commerce.freeShippingAbovePaise) return 0;
  return commerce.shippingFlatPaise;
}
