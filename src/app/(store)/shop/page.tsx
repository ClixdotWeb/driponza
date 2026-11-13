import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHero } from "@/components/store/PageHero";
import { ProductCard } from "@/components/store/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { SortSelect } from "@/components/store/SortSelect";
import { cn } from "@/lib/utils";
import { getPackSizes, getStoreCategories, searchProducts, type SortKey } from "@/server/catalog";

export const metadata: Metadata = { title: "Shop spices", description: "Shop Driponza whole spices — cardamom, cloves, cinnamon, mace, nutmeg, star anise, bay leaf and black pepper." };

const SORTS: SortKey[] = ["featured", "price-asc", "price-desc", "name", "newest", "bestselling", "popular"];
const PER_PAGE = 24;
const rupees = (v?: string) => (v && /^d{1,6}$/.test(v) ? Number(v) * 100 : undefined);

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q?.slice(0, 80) ?? "";
  const category = sp.category ?? "";
  const sort = (SORTS.includes(sp.sort as SortKey) ? sp.sort : "featured") as SortKey;
  const inStock = sp.instock === "1";
  const minPaise = rupees(sp.min);
  const maxPaise = rupees(sp.max);
  const weight = sp.weight && /^d{1,5}$/.test(sp.weight) ? Number(sp.weight) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [categories, all, sizes] = await Promise.all([
    getStoreCategories(),
    searchProducts({ q, category: category || undefined, sort, inStock, minPaise, maxPaise, weightGrams: weight }),
    getPackSizes(),
  ]);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const products = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const filtered = Boolean(minPaise !== undefined || maxPaise !== undefined || weight);
  const active = categories.find((c) => c.slug === category);

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged = { q, category, sort: sort === "featured" ? "" : sort, instock: inStock ? "1" : "", min: sp.min ?? "", max: sp.max ?? "", weight: sp.weight ?? "", page: "", ...patch };
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

        <details className="group mt-6 rounded-[22px] border border-cream-200 bg-white" open={filtered}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-medium">
            <span>Filters{filtered ? " · active" : ""}</span>
            <span className="text-ink-500 transition group-open:rotate-180">⌄</span>
          </summary>
          <form action="/shop" className="grid gap-4 border-t border-cream-200 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
            {q && <input type="hidden" name="q" value={q} />}
            {category && <input type="hidden" name="category" value={category} />}
            {sort !== "featured" && <input type="hidden" name="sort" value={sort} />}
            <div>
              <label htmlFor="f-min" className="field-label">Min price (₹)</label>
              <input id="f-min" name="min" inputMode="numeric" defaultValue={sp.min} className="field-input py-2" />
            </div>
            <div>
              <label htmlFor="f-max" className="field-label">Max price (₹)</label>
              <input id="f-max" name="max" inputMode="numeric" defaultValue={sp.max} className="field-input py-2" />
            </div>
            <fieldset>
              <legend className="field-label">Pack size</legend>
              <div className="flex flex-wrap gap-2">
                <label className="chip cursor-pointer border-cream-200 has-[:checked]:border-forest-800 has-[:checked]:bg-forest-800 has-[:checked]:text-ivory-50"><input type="radio" name="weight" value="" defaultChecked={!weight} className="sr-only" />Any</label>
                {sizes.map((g) => (
                  <label key={g} className="chip cursor-pointer border-cream-200 has-[:checked]:border-forest-800 has-[:checked]:bg-forest-800 has-[:checked]:text-ivory-50">
                    <input type="radio" name="weight" value={g} defaultChecked={weight === g} className="sr-only" />{g >= 1000 ? `${g / 1000} kg` : `${g} g`}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="instock" value="1" defaultChecked={inStock} className="accent-green-600" /> In stock</label>
              <button className="btn btn-primary btn-sm">Apply</button>
              {filtered && <Link href={href({ min: null, max: null, weight: null })} className="text-sm text-ink-500 underline">Reset</Link>}
            </div>
          </form>
        </details>

        <p className="mt-8 text-sm text-ink-500" aria-live="polite">
          {all.length} product{all.length === 1 ? "" : "s"}{q ? ` for “${q}”` : ""}
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
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-2 text-sm">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-outline btn-sm text-forest-800">Previous</Link>}
            <span className="text-ink-500">Page {page} of {pages}</span>
            {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-outline btn-sm text-forest-800">Next</Link>}
          </nav>
        )}
      </section>
    </>
  );
}
