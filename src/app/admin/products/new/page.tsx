import Link from "next/link";
import { AdminHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { db } from "@/lib/db";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } });
  if (!categories.length) {
    return (
      <>
        <AdminHeader title="New product" />
        <p className="text-sm">Create a <Link href="/admin/categories" className="text-green-600 underline">category</Link> first.</p>
      </>
    );
  }
  return (
    <>
      <AdminHeader title="New product" description="Save the product first, then add images." />
      <ProductForm categories={categories} />
    </>
  );
}
