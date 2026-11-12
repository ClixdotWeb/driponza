"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { hashToken, randomToken } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { adminEmail, notify } from "@/server/notify";
import { safeRedirect } from "@/lib/utils";
import { mergeGuestCart } from "@/server/cart";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

/** Echo non-secret fields back so React 19 form resets don't wipe what the user typed. */
function keep(form: FormData, ...names: string[]) {
  return Object.fromEntries(names.map((n) => [n, String(form.get(n) ?? "")]));
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);
const password = z.string().min(8, "Use at least 8 characters").max(128);

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email,
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .or(z.literal("")),
  password,
  confirm: z.string(),
  marketing: z.preprocess((v) => v === "on", z.boolean()).optional(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("register", 5, 15 * 60_000);
  if (!limited.ok) return { error: "Too many attempts. Please try again later." };
  const values = keep(form, "name", "email", "phone");
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { name, phone } = parsed.data;
  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { fieldErrors: { email: "An account with this email already exists. Try signing in." }, values };
  const user = await db.user.create({
    data: { name, email: parsed.data.email, phone: phone || null, passwordHash: await hashPassword(parsed.data.password), marketingOptIn: Boolean(parsed.data.marketing) },
  });
  await sendVerificationEmail(user.id);
  await createSession(user.id);
  await mergeGuestCart(user.id);
  redirect(safeRedirect(form.get("next"), "/account"));
}

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("login", 10, 15 * 60_000);
  if (!limited.ok) return { error: "Too many sign-in attempts. Please wait a few minutes.", values: keep(form, "email") };
  const values = keep(form, "email");
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : await dummyVerify(parsed.data.password);
  if (!user || !ok || !user.isActive) return { error: "Incorrect email or password.", values };
  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await mergeGuestCart(user.id);
  const fallback = user.role === "ADMIN" ? "/admin" : "/account";
  redirect(safeRedirect(form.get("next"), fallback));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("forgot", 5, 15 * 60_000);
  if (!limited.ok) return { error: "Too many requests. Please try again later." };
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: "Enter a valid email address" }, values: keep(form, "email") };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && user.isActive) {
    const token = randomToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    const link = `${process.env.APP_URL ?? ""}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your Driponza password",
      `Hello ${user.name},\n\nUse the link below to set a new password. It expires in 1 hour.\n\n${link}\n\nIf you didn't request this, you can ignore this email.\n\n— Driponza`,
    );
  }
  // Same response either way so the form can't be used to discover registered emails.
  return { success: "If an account exists for that email, a reset link is on its way." };
}

const resetSchema = z
  .object({ token: z.string().min(20).max(200), password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await rateLimit("reset", 10, 15 * 60_000);
  if (!limited.ok) return { error: "Too many attempts. Please try again later." };
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }), // sign out everywhere
  ]);
  await createSession(record.userId);
  redirect("/account?reset=1");
}

const passwordChangeSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const limited = await rateLimit("change-password", 10, 15 * 60_000);
  if (!limited.ok) return { error: "Too many attempts. Please try again later." };
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { fieldErrors: { current: "Current password is incorrect" } };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  // Sign out every other device; keep this one signed in with a fresh session.
  await db.session.deleteMany({ where: { userId: me.id } });
  await createSession(me.id);
  return { success: "Password updated. Other devices have been signed out." };
}

// ─────────── Email verification ───────────

async function sendVerificationEmail(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  const token = randomToken();
  await db.emailVerificationToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 48 * 3600_000) } });
  const link = `${process.env.APP_URL ?? ""}/verify-email?token=${token}`;
  await notify({
    to: user.email,
    template: "customer.verify-email",
    subject: "Confirm your email – Driponza",
    body: `Hello ${user.name},

Please confirm your email address (link valid for 48 hours):

${link}

— Driponza`,
  });
}

export async function resendVerificationAction(): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, message: "Please sign in." };
  const limited = await rateLimit("verify-resend", 3, 60 * 60_000);
  if (!limited.ok) return { ok: false, message: "Please wait before requesting another email." };
  await sendVerificationEmail(me.id);
  return { ok: true, message: "Verification email sent – check your inbox." };
}

/** Called by the /verify-email page. Single-use, expiring, hashed token. */
export async function verifyEmailToken(token: string) {
  if (!token || token.length > 200) return false;
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return false;
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}

// ─────────── Account deletion & preferences ───────────

export async function requestDeletionAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) return { fieldErrors: { password: "Password is incorrect" } };
  await db.user.update({ where: { id: me.id }, data: { deletionRequestedAt: new Date(), marketingOptIn: false } });
  const admin = adminEmail();
  if (admin) await notify({ to: admin, template: "admin.deletion-request", subject: "Account deletion request", body: `${user.email} asked for their account to be deleted.
${process.env.APP_URL ?? ""}/admin/customers/${user.id}` });
  return { success: "Request received. We'll delete your personal data (orders must be kept for tax records) and email you once done." };
}

export async function savePreferencesAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in." };
  await db.user.update({ where: { id: me.id }, data: { marketingOptIn: form.get("marketing") === "on" } });
  return { success: "Preferences saved." };
}
