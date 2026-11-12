import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";

/** Records a staff/customer action. Must never contain passwords, tokens or bank credentials. */
export async function audit(args: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  data?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}) {
  let ip: string | null = null;
  try {
    ip = clientIp(await headers());
  } catch {
    ip = null; // outside a request (scripts / cron)
  }
  const client = args.tx ?? db;
  await client.auditLog.create({
    data: {
      actorId: args.actorId,
      action: args.action,
      entity: args.entity,
      entityId: args.entityId ?? null,
      summary: args.summary.slice(0, 500),
      data: args.data,
      ip,
    },
  });
}
