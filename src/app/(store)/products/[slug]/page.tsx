import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, PackageCheck, ShieldCheck } from "lucide-react";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductPurchase } from "@/components/store/ProductPurchase";
import { ProductCard } from "@/components/store/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/razorpay";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.displayName,
    description: product.description.slice(0, 160),
    openGraph: { images: product.images[0] ? [product.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(product), getSettings()]);
  const first = product.variants[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Driponza" },
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      priceCurrency: "INR",
      price: (v.pricePaise / 100).toFixed(2),
      availability: v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x pt-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
          <Link href="/" className="hover:text-forest-800">Home</Link>
          <ChevronRight className="size-3" />
          <Link href="/shop" className="hover:text-forest-800">Shop</Link>
          <ChevronRight className="size-3" />
          <Link href={`/shop?category=${product.category.slug}`} className="hover:text-forest-800">{product.category.name}</Link>
          <ChevronRight className="size-3" />
          <span className="text-ink-700">{product.displayName}</span>
        </nav>
      </div>

      <section className="container-x grid gap-10 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-12">
        <ProductGallery images={product.images} name={product.displayName} />
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow text-green-600">{product.tag ?? product.category.name}</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,5vw,4.4rem)]">{product.displayName}</h1>
          <p className="mt-5 max-w-lg leading-relaxed text-ink-700">{product.description}</p>
          {first ? (
            <ProductPurchase productId={product.id} variants={product.variants} />
          ) : (
            <p className="mt-8 rounded-2xl bg-cream-100 p-5 text-sm text-ink-700">This product is currently unavailable.</p>
          )}
          <ul className="mt-8 grid gap-3 border-t border-cream-200 pt-6 text-sm text-ink-700">
            <li className="flex items-center gap-3"><PackageCheck className="size-4 text-green-600" /> Carefully selected and packed with care</li>
            {razorpayConfigured() && <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-green-600" /> Secure payments via Razorpay</li>}
            <li className="flex items-center gap-3">
              <MessageCircle className="size-4 text-green-600" />
              <span>
                Questions?{" "}
                <a href={`https://wa.me/${settings.contact.whatsapp}?text=${encodeURIComponent(`Hello Driponza, I have a question about ${product.displayName}.`)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-green-600">
                  Ask us on WhatsApp
                </a>
              </span>
            </li>
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-x border-t border-cream-200 py-20" aria-labelledby="related-title">
          <h2 id="related-title" className="display text-[clamp(2.2rem,4.5vw,3.6rem)]">
            You may also <em className="text-green-600">like</em>
          </h2>
          <Reveal className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Reveal>
        </section>
      )}
    </>
  );
}
