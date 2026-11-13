/**
 * Creates (or promotes) an admin account.
 *   npm run admin:create -- owner@example.com "Owner Name" "a-strong-password"
 * or set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD in the environment.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const [argEmail, argName, argPassword] = process.argv.slice(2);
  const email = (argEmail ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = argName ?? process.env.ADMIN_NAME ?? "Driponza Admin";
  const password = argPassword ?? process.env.ADMIN_PASSWORD ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Provide a valid admin email");
  if (password.length < 10) throw new Error("Admin password must be at least 10 characters");

  const passwordHash = await bcrypt.hash(password, 12);
  await db.staffRole.upsert({ where: { id: "role_super_admin" }, create: { id: "role_super_admin", name: "Super Admin", description: "Full access to every module, staff and settings", permissions: ["*"], isSystem: true }, update: { permissions: ["*"], isSystem: true } });
  const user = await db.user.upsert({
    where: { email },
    update: { role: "ADMIN", staffRoleId: "role_super_admin", passwordHash, isActive: true, emailVerifiedAt: new Date() },
    create: { email, name, passwordHash, role: "ADMIN", staffRoleId: "role_super_admin", emailVerifiedAt: new Date() },
  });
  console.log(`Admin ready: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
