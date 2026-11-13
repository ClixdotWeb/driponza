import { db } from "@/lib/db";
import { getStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { csvResponse } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stock sheet in the same format the bulk import accepts (edit and re-upload). */
export async function GET() {
  const staff = await getStaff();
  if (!staff || !hasPermission(staff.permissions, "inventory.view")) return new Response("Not authorised", { status: 403 });
  const variants = await db.productVariant.findMany({ orderBy: [{ product: { name: "asc" } }, { position: "asc" }], include: { product: { select: { name: true } } } });
  return csvResponse(
    `driponza-stock-${new Date().toISOString().slice(0, 10)}.csv`,
    ["sku", "product", "variant", "stock", "price", "mrp", "low_stock", "damaged", "cost"],
    variants.map((v) => [v.sku, v.product.name, v.label, v.stock, v.price.toString(), v.mrp?.toString() ?? "", v.lowStockThreshold, v.damagedStock, v.costPrice?.toString() ?? ""]),
  );
}
