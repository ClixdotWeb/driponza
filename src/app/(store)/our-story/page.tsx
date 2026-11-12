import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/store/PageHero";
import { ParallaxMedia, Reveal } from "@/components/motion/Reveal";
import { getSettings } from "@/lib/settings";
import { getFeaturedProducts } from "@/server/catalog";

export const metadata: Metadata = { title: "Our story", description: "At Driponza, we believe the right spice can transform an ordinary dish into something extraordinary." };

export default async function OurStoryPage() {
  const [{ content }, products] = await Promise.all([getSettings(), getFeaturedProducts(4)]);
  return (
    <>
      <PageHero eyebrow="Our story" title={<>Nurture. Grow. <em className="text-leaf-200">Thrive.</em></>}>
        {content.storyText}
      </PageHero>

      <section className="container-x grid items-center gap-12 py-20 md:py-28 lg:grid-cols-2 lg:gap-20">
        <ParallaxMedia className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)]">
          <div className="absolute inset-0">
            <Image src="/brand/story.jpg" alt="Hands holding a heart of whole spices" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
        </ParallaxMedia>
        <Reveal>
          <p className="eyebrow text-green-600">What we believe</p>
          <h2 className="display mt-5 text-[clamp(2.6rem,5vw,4.4rem)]">{content.storyTitle}</h2>
          <p className="mt-6 leading-relaxed text-ink-700">{content.storyText}</p>
          <p className="mt-6 font-[family-name:var(--font-script)] text-3xl text-green-600">Pure Spices. Bold Flavour.</p>
        </Reveal>
      </section>

      <section className="paper-green mx-2 rounded-[var(--radius-panel)] md:mx-3">
        <div className="container-x py-20 text-center md:py-28">
          <p className="eyebrow text-green-600">The Driponza promise</p>
          <p className="display mx-auto mt-6 max-w-4xl text-[clamp(1.9rem,3.6vw,3.2rem)] leading-[1.12] text-forest-900">{content.statement}</p>
        </div>
      </section>

      {products.length > 0 && (
        <section className="container-x py-20 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="display text-[clamp(2.4rem,5vw,4rem)]">From our <em className="text-green-600">kitchen shelf</em></h2>
            <Link href="/shop" className="btn btn-primary">Shop all spices</Link>
          </div>
          <Reveal className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {products.map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="group relative aspect-[3/4] overflow-hidden rounded-[22px] bg-cream-100">
                {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="(min-width:768px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />}
                <span className="absolute inset-x-3 bottom-3 rounded-full bg-ivory-50/90 px-4 py-2 text-center text-xs backdrop-blur">{p.displayName}</span>
              </Link>
            ))}
          </Reveal>
        </section>
      )}
    </>
  );
}
