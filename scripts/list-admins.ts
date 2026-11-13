/**
 * Lists admin / staff accounts (read-only).
 *   npm run admin:list
 * Uses DATABASE_URL from the environment (or .env).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const users = await db.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { staffRoleId: { not: null } }] },
    select: { email: true, name: true, role: true, staffRoleId: true, isActive: true, createdAt: true, lastLoginAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.table(users);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
