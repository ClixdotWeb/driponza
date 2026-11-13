import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export const emailConfigured = () => Boolean(process.env.SMTP_HOST);

/** "someone@example.com" → "s***@example.com", so logs stay useful without carrying the address. */
function maskEmail(address: string) {
  const [name = "", domain = ""] = address.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured()) {
    // AWAITING CREDENTIALS: no SMTP configured. Record that it was skipped, but never
    // the body or the full address – server logs are not a place for customer data.
    // The full message is already kept in NotificationLog, which only staff can read.
    console.info(`[email:not-sent] subject="${subject.slice(0, 80)}" to=${maskEmail(to)}`);
    return { sent: false };
  }
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error("[email:error]", err);
    return { sent: false };
  }
}
