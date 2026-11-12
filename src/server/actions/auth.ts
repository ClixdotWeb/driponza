"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { hashToken, randomToken } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
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
});

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
    data: { name, email: parsed.data.email, phone: phone || null, passwordHash: await hashPassword(parsed.data.password) },
  });
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
  return { success: "Password updated." };
}
