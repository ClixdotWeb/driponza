import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export const emailConfigured = () => Boolean(process.env.SMTP_HOST);

export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured()) {
    // AWAITING CREDENTIALS: no SMTP configured – log instead of sending.
    console.info(`[email:not-sent] to=${to} subject="${subject}"\n${text}`);
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
