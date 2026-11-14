import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";
import { hasPermission, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "dz_session";
const SESSION_DAYS = 30;

/**
 * A `Secure` cookie is only stored and sent back over HTTPS, so marking one Secure
 * on a site served over plain HTTP silently breaks sign-in: the browser drops it and
 * every following request looks signed out. Follow the site's own scheme instead of
 * NODE_ENV, falling back to NODE_ENV when APP_URL isn't set.
 */
export function secureCookies() {
  const url = process.env.APP_URL;
  if (url) return url.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

export type SessionUser = { id: string; email: string; name: string; phone: string | null; role: "CUSTOMER" | "ADMIN" };

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: clientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, phone: true, role: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { isActive: _ignored, ...user } = session.user;
  return user;
});

export async function requireUser(returnTo = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export type StaffUser = SessionUser & { permissions: string[]; roleName: string | null };

/** Staff = ADMIN account with an assigned role. Permissions are re-read from the DB on every request. */
export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  const row = await db.user.findUnique({ where: { id: user.id }, select: { staffRole: { select: { name: true, permissions: true } } } });
  return { ...user, permissions: row?.staffRole?.permissions ?? [], roleName: row?.staffRole?.name ?? null };
});

export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const staff = await getStaff();
  if (!staff) redirect("/");
  return staff;
}

/** Page guard: redirects to the dashboard with a notice if the role lacks the permission. */
export async function requirePermission(permission: Permission) {
  const staff = await requireStaff();
  if (!hasPermission(staff.permissions, permission)) redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  return staff;
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`You don't have permission to do this (${permission}).`);
  }
}

/** Action/route guard: throws instead of redirecting. */
export async function assertPermission(permission: Permission) {
  const staff = await getStaff();
  if (!staff || !hasPermission(staff.permissions, permission)) throw new ForbiddenError(permission);
  return staff;
}

/** @deprecated use requireStaff / requirePermission */
export const requireAdmin = requireStaff;

export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}
