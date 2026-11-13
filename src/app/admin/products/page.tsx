import Image from "next/image";
import { requirePermission } from "@/lib/auth/session";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Pencil, Plus, Star } from "lucide-react";
import { AdminHeader, Empty, Table } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatINR, toPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; review?: string; status?: string }> }) {
  await requirePermission("products.view");
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } }] } : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(sp.review ? { needsReview: true } : {}),
    ...(sp.status === "active" ? { isActive: true } : sp.status === "hidden" ? { isActive: false } : {}),
  };
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { featuredOrder: "asc" }, { createdAt: "asc" }],
      include: { category: true, images: { take: 1, orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } } },
    }),
    db.category.findMany({ orderBy: { position: "asc" } }),
  ]);

  return (
    <>
      <AdminHeader
        title="Products"
        description="Add, edit and organise the catalogue. Changes appear on the store immediately."
        actions={<Link href="/admin/products/new" className="btn btn-primary"><Plus className="size-4" /> New product</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search name or SKU" className="field-input w-56 py-2" />
        <select name="category" defaultValue={sp.category ?? ""} className="field-input w-48 py-2">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="field-input w-40 py-2">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" name="review" value="1" defaultChecked={Boolean(sp.review)} className="accent-green-600" /> Needs review</label>
        <button className="btn btn-outline btn-sm text-forest-800">Filter</button>
      </form>
      {products.length ? (
        <Table>
          <thead><tr><th>Product</th><th>Category</th><th>Variants</th><th>Price</th><th>Stock</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + v.stock, 0);
              const prices = p.variants.map((v) => toPaise(v.price));
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-cream-100">
                        {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="44px" className="object-cover" />}
                      </span>
                      <span>
                        <span className="font-medium text-forest-800 hover:underline">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                          {p.isFeatured && <span className="inline-flex items-center gap-1"><Star className="size-3 fill-current text-[#c9a44c]" /> Featured</span>}
                          {p.needsReview && <span className="inline-flex items-center gap-1 text-warning-500"><AlertTriangle className="size-3" /> Needs review</span>}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-ink-700">{p.category.name}</td>
                  <td className="text-ink-700">{p.variants.map((v) => v.label).join(", ")}</td>
                  <td className="tabular-nums">{prices.length ? formatINR(Math.min(...prices)) : "—"}</td>
                  <td className={cn("tabular-nums", stock === 0 && "text-danger-600")}>{stock}</td>
                  <td><span className={cn("rounded-full px-2.5 py-1 text-[11px]", p.isActive ? "bg-botanical-100 text-green-600" : "bg-cream-100 text-ink-500")}>{p.isActive ? "Active" : "Hidden"}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${p.id}`}
                        title="Edit"
                        aria-label={`Edit ${p.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-cream-200 text-ink-500 transition hover:border-forest-800 hover:text-forest-800"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <Link
                        href={`/products/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View on store"
                        aria-label={`View ${p.name} on the store`}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-cream-200 text-ink-500 transition hover:border-forest-800 hover:text-forest-800"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Empty>No products match.</Empty>
      )}
    </>
  );
}
