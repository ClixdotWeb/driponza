/**
 * Prepares a LOCAL test database for the e2e suite. Refuses to run against a non-local DATABASE_URL.
 * Usage: npx tsx tests/e2e/setup-db.ts   (after `npm run db:deploy` and `npm run db:seed`)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to modify a non-local database. Point DATABASE_URL at a local test database.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const set = (key: string, value: object) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  const commerce = (await db.setting.findUnique({ where: { key: "commerce" } }))?.value as object | undefined;
  await set("commerce", { ...(commerce ?? {}), bankTransferEnabled: true, codEnabled: true, codChargePaise: 0, bankTransferHoldHours: 48, shippingFlatPaise: 5000, freeShippingAbovePaise: 100000, minOrderPaise: 0, maxQtyPerLine: 20, returnWindowDays: null, shippingConfigured: true });
  // Obviously fake test values – never real bank data.
  await set("bank", { accountName: "TEST ACCOUNT", bankName: "Test Bank", accountNumber: "000011112222", ifsc: "TEST0000001", branch: "Test", upiId: "", instructions: "" });

  await db.shippingZone.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await db.shippingZone.createMany({
    data: [
      { name: "E2E Kozhikode", pincodePrefixes: ["673"], ratePaise: 4000, freeAbovePaise: 100000, codAllowed: true, codChargePaise: 2000, minDays: 1, maxDays: 2, position: 0 },
      { name: "E2E Rest of India", ratePaise: 9000, codAllowed: false, minDays: 4, maxDays: 8, position: 1 },
    ],
  });

  await db.productVariant.updateMany({ data: { stock: 50 } });
  // One variant with a single unit for the "last item" race test.
  const last = await db.productVariant.findFirst({ orderBy: { sku: "asc" }, skip: 1 });
  if (last) await db.productVariant.update({ where: { id: last.id }, data: { stock: 1 } });

  await db.coupon.upsert({ where: { code: "E2E10" }, create: { code: "E2E10", type: "PERCENT", value: "10", isActive: true }, update: { isActive: true, endsAt: null, usedCount: 0, usageLimit: null } });
  await db.coupon.upsert({ where: { code: "E2EOLD" }, create: { code: "E2EOLD", type: "PERCENT", value: "10", isActive: true, endsAt: new Date("2020-01-01") }, update: { endsAt: new Date("2020-01-01") } });

  await db.staffRole.upsert({ where: { id: "role_super_admin" }, create: { id: "role_super_admin", name: "Super Admin", permissions: ["*"], isSystem: true }, update: {} });
  await db.staffRole.upsert({ where: { id: "role_customer_support" }, create: { id: "role_customer_support", name: "Customer Support", permissions: ["dashboard.view", "orders.view", "customers.view", "support.manage", "returns.manage", "reviews.moderate"], isSystem: true }, update: {} });
  const hash = await bcrypt.hash("E2e-admin-pass-123", 12);
  await db.user.upsert({ where: { email: "e2e-admin@example.test" }, create: { email: "e2e-admin@example.test", name: "E2E Admin", passwordHash: hash, role: "ADMIN", staffRoleId: "role_super_admin" }, update: { passwordHash: hash, role: "ADMIN", staffRoleId: "role_super_admin", isActive: true } });
  await db.user.upsert({ where: { email: "e2e-support@example.test" }, create: { email: "e2e-support@example.test", name: "E2E Support", passwordHash: hash, role: "ADMIN", staffRoleId: "role_customer_support" }, update: { passwordHash: hash, role: "ADMIN", staffRoleId: "role_customer_support", isActive: true } });
  await db.user.upsert({ where: { email: "e2e-customer@example.test" }, create: { email: "e2e-customer@example.test", name: "E2E Fixed Customer", passwordHash: await bcrypt.hash("Customer-pass-1", 12) }, update: { isActive: true, role: "CUSTOMER", staffRoleId: null } });
  await db.rateLimitBucket.deleteMany({});
  fs.writeFileSync(path.join(__dirname, ".run-id"), String(Date.now()));
  console.log("e2e test data ready");
}

main().finally(() => db.$disconnect());
