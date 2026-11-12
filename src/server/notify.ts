import "server-only";
import { db } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";

export const MAX_ATTEMPTS = 5;

/**
 * Logs and sends one email. Never throws – a notification failure must not break the business action
 * that triggered it. `dedupeKey` makes the same event send at most once (e.g. "order-placed:<id>").
 */
export async function notify(args: {
  to: string | null | undefined;
  template: string;
  subject: string;
  body: string;
  orderId?: string | null;
  dedupeKey?: string;
}) {
  if (!args.to) return;
  try {
    let log;
    try {
      log = await db.notificationLog.create({
        data: {
          to: args.to,
          template: args.template,
          subject: args.subject.slice(0, 300),
          body: args.body,
          orderId: args.orderId ?? null,
          dedupeKey: args.dedupeKey ?? null,
          status: emailConfigured() ? "QUEUED" : "SKIPPED",
          error: emailConfigured() ? null : "Email provider not configured (SMTP_HOST unset)",
        },
      });
    } catch (err) {
      // Unique violation on dedupeKey = already sent for this event.
      if ((err as { code?: string }).code === "P2002") return;
      throw err;
    }
    if (log.status === "SKIPPED") return;
    await deliver(log.id);
  } catch (err) {
    console.error("[notify]", args.template, err);
  }
}

export async function deliver(id: string) {
  const log = await db.notificationLog.findUnique({ where: { id } });
  if (!log || log.status === "SENT") return;
  const res = await sendEmail(log.to, log.subject, log.body);
  await db.notificationLog.update({
    where: { id },
    data: { attempts: { increment: 1 }, status: res.sent ? "SENT" : "FAILED", error: res.sent ? null : "Delivery failed (see server log)" },
  });
}

/** Retries failed (and, once SMTP is configured, skipped) notifications. Called by cron. */
export async function retryNotifications(limit = 25) {
  if (!emailConfigured()) return 0;
  const due = await db.notificationLog.findMany({
    where: { status: { in: ["FAILED", "QUEUED"] }, attempts: { lt: MAX_ATTEMPTS }, createdAt: { gte: new Date(Date.now() - 3 * 864e5) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const n of due) await deliver(n.id);
  return due.length;
}

export function adminEmail() {
  return process.env.ADMIN_NOTIFY_EMAIL || null;
}
