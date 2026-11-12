import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHero } from "@/components/store/PageHero";
import { ProductCard } from "@/components/store/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { SortSelect } from "@/components/store/SortSelect";
import { cn } from "@/lib/utils";
import { getStoreCategories, searchProducts, type SortKey } from "@/server/catalog";

export const metadata: Metadata = { title: "Shop spices", description: "Shop Driponza whole spices — cardamom, cloves, cinnamon, mace, nutmeg, star anise, bay leaf and black pepper." };

const SORTS: SortKey[] = ["featured", "price-asc", "price-desc", "name", "newest"];

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q?.slice(0, 80) ?? "";
  const category = sp.category ?? "";
  const sort = (SORTS.includes(sp.sort as SortKey) ? sp.sort : "featured") as SortKey;
  const inStock = sp.instock === "1";

  const [categories, products] = await Promise.all([getStoreCategories(), searchProducts({ q, category: category || undefined, sort, inStock })]);
  const active = categories.find((c) => c.slug === category);

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged = { q, category, sort: sort === "featured" ? "" : sort, instock: inStock ? "1" : "", ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  return (
    <>
      <PageHero eyebrow="The collection" title={active ? active.name : q ? <>Results for <em>“{q}”</em></> : <>Shop all <em className="text-leaf-200">spices</em></>}>
        {active?.description ?? "Carefully selected spices with rich aroma and authentic flavour."}
      </PageHero>

      <section className="container-x py-12 md:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <Link href={href({ category: null })} className={cn("chip shrink-0", !category ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200 text-ink-700 hover:border-forest-800")}>
              All products
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={href({ category: c.slug })}
                className={cn("chip shrink-0", category === c.slug ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200 text-ink-700 hover:border-forest-800")}
              >
                {c.name} <span className="opacity-60">{c.count}</span>
              </Link>
            ))}
            <Link href={href({ instock: inStock ? null : "1" })} className={cn("chip shrink-0", inStock ? "border-green-600 bg-green-600 text-ivory-50" : "border-cream-200 text-ink-700 hover:border-forest-800")}>
              In stock only
            </Link>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form action="/shop" role="search" className="flex items-center rounded-full border border-cream-200 bg-white pl-4 focus-within:border-leaf-500">
              {category && <input type="hidden" name="category" value={category} />}
              <Search className="size-4 text-ink-500" />
              <label htmlFor="shop-q" className="sr-only">Search products</label>
              <input id="shop-q" name="q" defaultValue={q} placeholder="Search spices…" className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm outline-none sm:w-56" />
            </form>
            <SortSelect value={sort} />
          </div>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>

        {products.length ? (
          <Reveal className="mt-6 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </Reveal>
        ) : (
          <div className="mt-6 rounded-[22px] bg-cream-100 px-6 py-20 text-center">
            <p className="display text-4xl">Nothing found</p>
            <p className="mt-3 text-ink-500">Try another search or browse all products.</p>
            <Link href="/shop" className="btn btn-primary mt-6">Clear filters</Link>
          </div>
        )}
      </section>
    </>
  );
}
