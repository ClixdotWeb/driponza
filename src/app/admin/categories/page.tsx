import { AdminHeader, Panel } from "@/components/admin/ui";
import { CategoryForm } from "@/components/admin/Forms";
import { db } from "@/lib/db";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await db.category.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <AdminHeader title="Categories" description="Categories without active products are hidden on the store automatically." />
      <div className="grid gap-4">
        {categories.map((c) => (
          <Panel key={c.id} title={`${c.name} · ${c._count.products} product(s)`}>
            <CategoryForm category={{ id: c.id, name: c.name, slug: c.slug, description: c.description, position: c.position, isActive: c.isActive, count: c._count.products }} />
          </Panel>
        ))}
        <Panel title="Add category">
          <CategoryForm />
        </Panel>
      </div>
    </>
  );
}
