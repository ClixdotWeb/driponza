"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, ForbiddenError } from "@/lib/auth/session";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { toPaise } from "@/lib/money";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import type { FormState } from "@/server/actions/auth";

async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Invalid input" };
    console.error("[admin-store]", err);
    return { error: "Something went wrong – nothing was changed." };
  }
}
const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
const optMoney = z.string().trim().regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Enter an amount").optional();

// ─────────── FAQ ───────────

const faqSchema = z.object({
  id: z.string().cuid().optional().or(z.literal("")),
  question: z.string().trim().min(5, "Enter the question").max(200),
  answer: z.string().trim().min(5, "Enter the answer").max(2000),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isPublished: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveFaqAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("content.manage");
    const parsed = faqSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const { id, ...data } = parsed.data;
    if (id) await db.faqItem.update({ where: { id }, data });
    else await db.faqItem.create({ data });
    await audit({ actorId: staff.id, action: "content.faq", entity: "FaqItem", entityId: id || null, summary: `Saved FAQ “${data.question.slice(0, 60)}”` });
    revalidatePath("/", "layout");
    return { success: "FAQ saved." };
  });
}

export async function deleteFaqAction(id: string) {
  const staff = await assertPermission("content.manage");
  await db.faqItem.delete({ where: { id } });
  await audit({ actorId: staff.id, action: "content.faq.delete", entity: "FaqItem", entityId: id, summary: "Deleted FAQ" });
  revalidatePath("/", "layout");
}

// ─────────── Shipping zones ───────────

const zoneSchema = z.object({
  id: z.string().cuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(60),
  pincodePrefixes: z.string().trim().max(2000).regex(/^[\d,\s]*$/, "Digits separated by commas"),
  states: z.array(z.string().max(60)).max(40),
  rate: z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a rate"),
  freeAbove: optMoney,
  codAllowed: z.preprocess((v) => v === "on", z.boolean()),
  codCharge: optMoney,
  minDays: z.coerce.number().int().min(0).max(60),
  maxDays: z.coerce.number().int().min(0).max(90),
  position: z.coerce.number().int().min(0).max(999),
  isActive: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveZoneAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("settings.manage");
    const parsed = zoneSchema.safeParse({ ...Object.fromEntries(form), states: form.getAll("states") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const d = parsed.data;
    if (d.maxDays < d.minDays) return { fieldErrors: { maxDays: "Must be ≥ min days" } };
    const prefixes = [...new Set(d.pincodePrefixes.split(/[,\s]+/).filter(Boolean))];
    if (prefixes.some((p) => p.length > 6 || p.startsWith("0"))) return { fieldErrors: { pincodePrefixes: "Prefixes are 1–6 digits and can't start with 0" } };
    const data = {
      name: d.name,
      pincodePrefixes: prefixes,
      states: d.states,
      ratePaise: toPaise(d.rate),
      freeAbovePaise: d.freeAbove ? toPaise(d.freeAbove) : null,
      codAllowed: d.codAllowed,
      codChargePaise: d.codCharge ? toPaise(d.codCharge) : 0,
      minDays: d.minDays,
      maxDays: d.maxDays,
      position: d.position,
      isActive: d.isActive,
    };
    if (d.id) await db.shippingZone.update({ where: { id: d.id }, data });
    else await db.shippingZone.create({ data });
    await audit({ actorId: staff.id, action: "shipping.zone", entity: "ShippingZone", entityId: d.id || null, summary: `Saved zone ${d.name}` });
    revalidatePath("/admin/shipping");
    return { success: "Zone saved." };
  });
}

export async function deleteZoneAction(id: string) {
  const staff = await assertPermission("settings.manage");
  await db.shippingZone.delete({ where: { id } });
  await audit({ actorId: staff.id, action: "shipping.zone.delete", entity: "ShippingZone", entityId: id, summary: "Deleted shipping zone" });
  revalidatePath("/admin/shipping");
}

// ─────────── Staff roles ───────────

export async function saveRoleAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("staff.manage");
    const parsed = z
      .object({ id: z.string().optional(), name: z.string().trim().min(2).max(40), description: z.string().trim().max(200).optional(), permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])) })
      .safeParse({ id: form.get("id") || undefined, name: form.get("name"), description: form.get("description") || undefined, permissions: form.getAll("permissions") });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    if (d.id === "role_super_admin") return { error: "The Super Admin role always has every permission." };
    const clash = await db.staffRole.findFirst({ where: { name: d.name, NOT: d.id ? { id: d.id } : undefined } });
    if (clash) return { error: "A role with this name exists." };
    const data = { name: d.name, description: d.description ?? null, permissions: d.permissions };
    if (d.id) await db.staffRole.update({ where: { id: d.id }, data });
    else await db.staffRole.create({ data });
    // Existing sessions pick up new permissions immediately (they are read from the DB on every request).
    await audit({ actorId: staff.id, action: "staff.role.save", entity: "StaffRole", entityId: d.id ?? null, summary: `Saved role ${d.name} (${d.permissions.length} permissions)` });
    revalidatePath("/admin/staff");
    return { success: "Role saved." };
  });
}

export async function deleteRoleAction(id: string) {
  const staff = await assertPermission("staff.manage");
  const role = await db.staffRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role || role.isSystem) return { error: "System roles can't be deleted." };
  if (role._count.users) return { error: "Move its staff to another role first." };
  await db.staffRole.delete({ where: { id } });
  await audit({ actorId: staff.id, action: "staff.role.delete", entity: "StaffRole", entityId: id, summary: `Deleted role ${role.name}` });
  revalidatePath("/admin/staff");
  return { success: "Role deleted." };
}

/** Grants staff access to an existing account by email (the person must register first – no passwords are set by admins). */
export async function inviteStaffAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("staff.manage");
    const email = z.string().trim().toLowerCase().email("Enter the account email").parse(form.get("email"));
    const roleId = z.string().min(1, "Choose a role").parse(form.get("roleId"));
    const [user, role] = await Promise.all([db.user.findUnique({ where: { email } }), db.staffRole.findUnique({ where: { id: roleId } })]);
    if (!role) return { error: "Role not found." };
    if (!user) return { error: "No account with this email. Ask them to register on the store first, then add them here." };
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN", staffRoleId: role.id } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await audit({ actorId: staff.id, action: "staff.add", entity: "User", entityId: user.id, summary: `${email} added as ${role.name}` });
    revalidatePath("/admin/staff");
    return { success: `${user.name} is now ${role.name}.` };
  });
}

// ─────────── Reviews ───────────

export async function moderateReviewAction(id: string, status: "APPROVED" | "REJECTED") {
  const staff = await assertPermission("reviews.moderate");
  const r = await db.review.update({ where: { id }, data: { status }, include: { product: { select: { slug: true } } } });
  await audit({ actorId: staff.id, action: `review.${status.toLowerCase()}`, entity: "Review", entityId: id, summary: `Review ${status.toLowerCase()}` });
  revalidatePath("/admin/reviews");
  revalidatePath(`/products/${r.product.slug}`);
}

// ─────────── Support ───────────

export async function updateTicketAction(_: FormState, form: FormData): Promise<FormState> {
  return guard(async () => {
    const staff = await assertPermission("support.manage");
    const d = z
      .object({ id: z.string().cuid(), status: z.enum(["OPEN", "PENDING", "CLOSED"]), staffNote: z.string().trim().max(2000).optional(), reply: z.string().trim().max(4000).optional() })
      .parse({ id: form.get("id"), status: form.get("status"), staffNote: form.get("staffNote") || undefined, reply: form.get("reply") || undefined });
    const t = await db.supportTicket.update({ where: { id: d.id }, data: { status: d.status, staffNote: d.staffNote ?? null } });
    if (d.reply) {
      await notify({ to: t.email, template: "customer.support-reply", subject: `Re: ${t.subject}`, body: `Hello ${t.name},\n\n${d.reply}\n\n— Driponza` });
    }
    await audit({ actorId: staff.id, action: "support.update", entity: "SupportTicket", entityId: t.id, summary: `Ticket ${d.status.toLowerCase()}${d.reply ? " + reply sent" : ""}` });
    revalidatePath("/admin/support");
    return { success: d.reply ? "Saved and reply emailed." : "Saved." };
  });
}
