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
  /** Used only when no shipping zones exist (acts as an "all India" zone). */
  shippingFlatPaise: z.number().int().min(0).max(1_000_000),
  freeShippingAbovePaise: z.number().int().min(0).max(100_000_000).nullable(),
  codEnabled: z.boolean(),
  codChargePaise: z.number().int().min(0).max(100_000),
  codMaxOrderPaise: z.number().int().min(0).max(100_000_000).nullable(),
  bankTransferEnabled: z.boolean(),
  /** Unpaid bank-transfer orders are cancelled and stock released after this many hours. */
  bankTransferHoldHours: z.number().int().min(1).max(24 * 14),
  minOrderPaise: z.number().int().min(0).max(100_000_000),
  maxQtyPerLine: z.number().int().min(1).max(500),
  /** Days after delivery a customer may request a return. Null = no automatic limit (staff decide per request). */
  returnWindowDays: z.number().int().min(0).max(365).nullable(),
  whatsappOrdering: z.boolean(),
  shippingConfigured: z.boolean(),
});

/** Shown only to a customer on their own unpaid bank-transfer order (never in public pages). */
export const bankSchema = z.object({
  accountName: z.string().max(120),
  bankName: z.string().max(120),
  accountNumber: z.string().max(34),
  ifsc: z.string().max(11),
  branch: z.string().max(120),
  upiId: z.string().max(80),
  instructions: z.string().max(2000),
});

export const businessSchema = z.object({
  legalName: z.string().max(160),
  gstin: z.string().max(15),
  invoicePrefix: z.string().regex(/^[A-Z0-9-]{0,12}$/, "Capital letters, digits and dashes only"),
  invoiceFooter: z.string().max(500),
  stateOfSupply: z.string().max(60),
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
    codChargePaise: 0,
    codMaxOrderPaise: null as number | null,
    bankTransferEnabled: false,
    bankTransferHoldHours: 48,
    minOrderPaise: 0,
    maxQtyPerLine: 20,
    returnWindowDays: null as number | null, // AWAITING BUSINESS RETURN POLICY
    whatsappOrdering: true,
    shippingConfigured: false,
  },
  policies: { privacy: "", terms: "", shipping: "", returns: "" },
  // AWAITING BUSINESS DETAILS – nothing here is invented; the owner fills these in Admin → Settings.
  bank: { accountName: "", bankName: "", accountNumber: "", ifsc: "", branch: "", upiId: "", instructions: "" },
  business: { legalName: "Driponza", gstin: "", invoicePrefix: "DZ", invoiceFooter: "", stateOfSupply: "Kerala" },
};

const schemas = {
  contact: contactSchema,
  content: contentSchema,
  commerce: commerceSchema,
  policies: policiesSchema,
  bank: bankSchema,
  business: businessSchema,
};

/** Bank transfer can be offered only when enabled AND the account details are filled in. */
export function bankTransferReady(s: Settings) {
  return s.commerce.bankTransferEnabled && Boolean(s.bank.accountName && s.bank.accountNumber && s.bank.ifsc);
}
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
