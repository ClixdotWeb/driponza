import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "@/server/audit";
import { adminEmail, notify } from "@/server/notify";
import { OrderError, transitionOrder } from "@/server/orders";
import type { ItemCondition, Prisma, ReturnStatus } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
const appUrl = () => process.env.APP_URL ?? "";

/** Customer return request for a delivered order. */
export async function requestReturn(args: {
  orderId: string;
  userId: string;
  reason: string;
  details: string | null;
  items: Array<{ orderItemId: string; quantity: number }>;
  imageKeys: string[];
}) {
  const { commerce } = await getSettings();
  const order = await db.order.findUniqueOrThrow({ where: { id: args.orderId }, include: { items: true, returns: { where: { status: { notIn: ["REJECTED", "CLOSED"] } } } } });
  if (order.userId !== args.userId) throw new OrderError("Order not found.");
  if (order.status !== "DELIVERED") throw new OrderError("Returns can be requested after the order is delivered.");
  if (order.returns.length) throw new OrderError("A return request is already open for this order.");
  if (commerce.returnWindowDays !== null && order.deliveredAt && Date.now() - order.deliveredAt.getTime() > commerce.returnWindowDays * 864e5) {
    throw new OrderError(`Returns must be requested within ${commerce.returnWindowDays} days of delivery.`);
  }
  const lines = args.items.filter((i) => i.quantity > 0);
  if (!lines.length) throw new OrderError("Choose at least one item to return.");
  for (const l of lines) {
    const item = order.items.find((i) => i.id === l.orderItemId);
    if (!item || l.quantity > item.quantity) throw new OrderError("Invalid return quantity.");
  }
  const ret = await db.$transaction(async (tx) => {
    const r = await tx.returnRequest.create({
      data: { orderId: order.id, userId: args.userId, reason: args.reason, details: args.details, imageKeys: args.imageKeys, items: { create: lines } },
    });
    await transitionOrder(order.id, "RETURN_REQUESTED", { actorId: args.userId, note: `Return requested: ${args.reason}`, system: true, tx });
    return r;
  });
  const admin = adminEmail();
  if (admin) await notify({ to: admin, template: "admin.return-request", subject: `Return requested – ${order.number}`, body: `Reason: ${args.reason}\n${args.details ?? ""}\n\n${appUrl()}/admin/returns/${ret.id}`, orderId: order.id });
  await notify({ to: order.email, template: "customer.return-requested", subject: `Return request received – ${order.number}`, body: `Hello ${order.customerName},\n\nWe've received your return request and will review it shortly.\n\n— Driponza`, orderId: order.id, dedupeKey: `return-requested:${ret.id}` });
  return ret;
}

/** Courier brought the parcel back (RTO): open an internal return so the goods are inspected before restocking. */
export async function openRtoReturn(tx: Tx, orderId: string, actorId: string | null) {
  const existing = await tx.returnRequest.findFirst({ where: { orderId, status: { notIn: ["REJECTED", "CLOSED"] } } });
  if (existing) return existing;
  const items = await tx.orderItem.findMany({ where: { orderId } });
  return tx.returnRequest.create({
    data: { orderId, reason: "Returned to origin (RTO)", status: "RECEIVED", resolutionNote: actorId ? null : "Opened automatically", items: { create: items.map((i) => ({ orderItemId: i.id, quantity: i.quantity })) } },
  });
}

const NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["RECEIVED", "CLOSED"],
  REJECTED: [],
  RECEIVED: ["INSPECTED"],
  INSPECTED: ["REFUNDED", "CLOSED"],
  REFUNDED: ["CLOSED"],
  CLOSED: [],
};

export async function updateReturn(
  returnId: string,
  to: ReturnStatus,
  opts: { actorId: string; note?: string | null; conditions?: Record<string, ItemCondition> },
) {
  const result = await db.$transaction(async (tx) => {
    const ret = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: { items: { include: { orderItem: true } }, order: true } });
    if (!NEXT[ret.status].includes(to)) throw new OrderError(`A ${ret.status.toLowerCase()} return can't be marked ${to.toLowerCase()}.`);
    const claimed = await tx.returnRequest.updateMany({ where: { id: returnId, status: ret.status }, data: { status: to, resolutionNote: opts.note ?? ret.resolutionNote } });
    if (claimed.count === 0) throw new OrderError("This return was just updated by someone else – reload the page.");

    if (to === "REJECTED" && ret.order.status === "RETURN_REQUESTED") {
      await transitionOrder(ret.orderId, "DELIVERED", { actorId: opts.actorId, note: `Return rejected${opts.note ? `: ${opts.note}` : ""}`, system: true, tx });
    }
    if (to === "RECEIVED" && ret.order.status === "RETURN_REQUESTED") {
      await transitionOrder(ret.orderId, "RETURNED", { actorId: opts.actorId, note: "Returned goods received", system: true, tx });
    }
    if (to === "INSPECTED") {
      // Stock changes only after inspection: resellable → back to sellable stock, damaged → written off.
      for (const item of ret.items) {
        const condition = opts.conditions?.[item.id];
        if (!condition) throw new OrderError("Mark every returned item as resellable or damaged.");
        await tx.returnItem.update({ where: { id: item.id }, data: { condition } });
        const variantId = item.orderItem.variantId;
        if (!variantId) continue;
        if (condition === "RESELLABLE") {
          const v = await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: item.quantity } } });
          await tx.inventoryMovement.create({ data: { variantId, change: item.quantity, stockAfter: v.stock, reason: "RETURN", orderId: ret.orderId, userId: opts.actorId, note: `Return ${ret.order.number} – resellable` } });
        } else {
          const v = await tx.productVariant.update({ where: { id: variantId }, data: { damagedStock: { increment: item.quantity } } });
          await tx.inventoryMovement.create({ data: { variantId, change: 0, stockAfter: v.stock, reason: "DAMAGE", orderId: ret.orderId, userId: opts.actorId, note: `Return ${ret.order.number} – ${item.quantity} damaged` } });
        }
      }
    }
    await audit({ tx, actorId: opts.actorId, action: `return.${to.toLowerCase()}`, entity: "ReturnRequest", entityId: returnId, summary: `${ret.order.number}: return ${ret.status} → ${to}` });
    return ret;
  });

  const labels: Partial<Record<ReturnStatus, string>> = { APPROVED: "approved – we'll arrange pickup or share return instructions", REJECTED: "declined", RECEIVED: "received at our warehouse", REFUNDED: "refunded" };
  if (labels[to]) {
    await notify({
      to: result.order.email,
      template: `customer.return.${to}`,
      subject: `Your return for ${result.order.number} was ${labels[to]!.split(" –")[0]}`,
      body: `Hello ${result.order.customerName},\n\nYour return request for order ${result.order.number} has been ${labels[to]}.${opts.note ? `\n\nNote: ${opts.note}` : ""}\n\n${appUrl()}/account/orders/${result.order.number}\n\n— Driponza`,
      orderId: result.orderId,
      dedupeKey: `return:${returnId}:${to}`,
    });
  }
}
