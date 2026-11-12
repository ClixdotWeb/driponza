import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageManager } from "@/components/admin/ImageManager";
import { DeleteProductButton, MarkReviewedButton } from "@/components/admin/ProductButtons";
import { db } from "@/lib/db";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const [product, categories] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } } } }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminHeader
        title={product.name}
        description={`/products/${product.slug}`}
        actions={
          <>
            {product.isActive && <Link href={`/products/${product.slug}`} target="_blank" className="btn btn-outline btn-sm text-forest-800">View on store ↗</Link>}
            <DeleteProductButton productId={product.id} />
          </>
        }
      />
      {created && <p className="mb-4 rounded-xl bg-botanical-100 px-4 py-3 text-sm text-forest-800">Product created. Now add images below.</p>}
      {product.needsReview && (
        <div className="mb-6 rounded-2xl border border-warning-500/40 bg-[#fbefd6] p-5 text-sm text-[#6b4700]">
          <p className="font-medium">This product needs review</p>
          <p className="mt-1 whitespace-pre-line">{product.reviewNotes}</p>
          <div className="mt-3"><MarkReviewedButton productId={product.id} /></div>
        </div>
      )}
      <div className="grid gap-6">
        <ImageManager productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? "" }))} />
        <ProductForm
          categories={categories}
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            tag: product.tag ?? "",
            categoryId: product.categoryId,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            featuredOrder: product.featuredOrder,
            needsReview: product.needsReview,
            reviewNotes: product.reviewNotes ?? "",
            variants: product.variants.map((v) => ({
              id: v.id,
              label: v.label,
              weightGrams: v.weightGrams,
              sku: v.sku,
              price: v.price.toString(),
              mrp: v.mrp?.toString() ?? "",
              stock: v.stock,
              lowStockThreshold: v.lowStockThreshold,
              isActive: v.isActive,
            })),
          }}
        />
      </div>
    </>
  );
}
