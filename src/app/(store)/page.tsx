import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { FinalCta } from "@/components/home/FinalCta";
import { HandfulFeature } from "@/components/home/HandfulFeature";
import { SpiceBackdrop } from "@/components/home/SpiceBackdrop";
import { Faq, type FaqItem } from "@/components/home/Faq";
import { ProductCard } from "@/components/store/ProductCard";
import { ParallaxMedia, Reveal } from "@/components/motion/Reveal";
import { BayLeaf, Cardamom, Cinnamon, Clove, Nutmeg, Peppercorn, StarAnise } from "@/components/spices/Spices";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/razorpay";
import { formatINR } from "@/lib/money";
import { cn, shortSpiceName } from "@/lib/utils";
import { getFeaturedProducts, searchProducts, type ProductView } from "@/server/catalog";

/** Section heading in the hero's language: italic index, eyebrow, serif title with a green italic accent. */
function SectionHead({ index, eyebrow, title, accent, children, center, id }: { index: string; eyebrow: string; title: string; accent: string; children?: React.ReactNode; center?: boolean; id: string }) {
  return (
    <div className={cn("flex flex-col gap-6", center ? "items-center text-center" : "md:flex-row md:items-end md:justify-between")}>
      <div className={center ? "max-w-3xl" : "max-w-2xl"}>
        <p className={cn("flex items-center gap-3", center && "justify-center")}>
          <span className="section-index">({index})</span>
          <span className="h-px w-8 bg-green-600/40" />
          <span className="eyebrow text-green-600">{eyebrow}</span>
        </p>
        <h2 id={id} className="display mt-5 text-[clamp(2.7rem,6vw,5.2rem)]">
          {title} <em className="text-green-600">{accent}</em>
        </h2>
      </div>
      {children && <div className={cn("max-w-sm text-[15px] leading-relaxed text-ink-700", center && "max-w-xl")}>{children}</div>}
    </div>
  );
}

// Dish columns for the pairing guide. A tick appears only when the product's own description mentions that use.
const DISHES = [
  { label: "Biryani & pulao", match: /biryani|pulao/i },
  { label: "Curries", match: /curr/i },
  { label: "Chai & tea", match: /\btea\b|chai/i },
  { label: "Desserts & baking", match: /dessert|baking/i },
  { label: "Soups", match: /soup/i },
  { label: "Blends & marinades", match: /blend|marinade/i },
];

// Brand qualities stated on Driponza's existing site.
const PROMISE = [
  { title: "Carefully selected", text: "Every spice is chosen for rich aroma and authentic flavour.", Icon: StarAnise },
  { title: "Quality checked", text: "Each pack is checked and packed with care before it reaches you.", Icon: Cardamom },
  { title: "Sealed for freshness", text: "Packed to keep the aroma in the pack — and then in your food.", Icon: BayLeaf },
  { title: "Easy ordering", text: "Order online in a few taps, or simply send your order on WhatsApp.", Icon: Clove },
];

// General cooking ideas; spice chips link to the real products.
const KITCHEN = [
  { title: "Masala chai", tip: "Lightly crush cardamom and simmer with cinnamon, cloves and star anise before adding tea and milk.", spices: ["cardamom", "cinnamon", "clove", "star anise"], art: "chai" },
  { title: "Dum biryani", tip: "Temper the whole spices in hot ghee until fragrant, then layer with rice and seal to cook on dum.", spices: ["bay leaf", "star anise", "mace", "cardamom", "clove", "cinnamon"], art: "biryani" },
  { title: "Home-made garam masala", tip: "Dry-roast whole spices on a low flame, cool completely, then grind in small batches.", spices: ["black pepper", "clove", "cinnamon", "cardamom", "nutmeg", "mace"], art: "masala" },
  { title: "Spiced desserts", tip: "Finish payasam, kheer or cakes with freshly crushed cardamom and a light grating of nutmeg.", spices: ["cardamom", "nutmeg", "cinnamon"], art: "dessert" },
];

function KitchenArt({ kind, uid }: { kind: string; uid: string }) {
  const s = "absolute drop-shadow-[0_14px_14px_rgba(0,0,0,0.35)]";
  switch (kind) {
    case "chai":
      return (<><Cardamom uid={`${uid}a`} className={`${s} left-[16%] top-[24%] w-10 -rotate-12`} /><Cinnamon uid={`${uid}b`} className={`${s} left-[26%] top-[54%] w-44 -rotate-6`} /><StarAnise uid={`${uid}c`} className={`${s} right-[12%] top-[14%] w-20`} /><Clove uid={`${uid}d`} className={`${s} right-[34%] top-[34%] w-6 rotate-45`} /></>);
    case "biryani":
      return (<><BayLeaf uid={`${uid}a`} className={`${s} left-[12%] top-[8%] w-14 -rotate-[30deg]`} /><StarAnise uid={`${uid}b`} className={`${s} left-[38%] top-[28%] w-24`} /><Cardamom uid={`${uid}c`} className={`${s} right-[14%] top-[14%] w-9 rotate-12`} /><Clove uid={`${uid}d`} className={`${s} bottom-[10%] right-[24%] w-6 -rotate-45`} /></>);
    case "masala":
      return (<><Peppercorn uid={`${uid}a`} className={`${s} left-[22%] top-[30%] w-5`} /><Peppercorn uid={`${uid}b`} className={`${s} left-[30%] top-[52%] w-4`} /><Nutmeg uid={`${uid}c`} className={`${s} left-[40%] top-[18%] w-24`} /><Clove uid={`${uid}d`} className={`${s} right-[16%] top-[16%] w-7 rotate-12`} /><Cinnamon uid={`${uid}e`} className={`${s} bottom-[10%] right-[6%] w-32 -rotate-12`} /></>);
    default:
      return (<><Cardamom uid={`${uid}a`} open className={`${s} left-[26%] top-[16%] w-12 -rotate-[40deg]`} /><Nutmeg uid={`${uid}b`} className={`${s} right-[20%] top-[26%] w-20`} /><Cardamom uid={`${uid}c`} className={`${s} bottom-[12%] left-[14%] w-8 rotate-[60deg]`} /></>);
  }
}

const findBySpice = (products: ProductView[], spice: string) => products.find((p) => p.name.toLowerCase().includes(spice));

export default async function HomePage() {
  const [settings, featured, all] = await Promise.all([getSettings(), getFeaturedProducts(8), searchProducts({})]);
  const { content, contact, commerce } = settings;
  const collection = featured.length ? featured : all;
  const handful = ["cardamom", "clove", "star anise", "black pepper", "cinnamon"].map((sp) => {
    const p = findBySpice(all, sp);
    return { label: p ? shortSpiceName(p.name) : sp, href: p ? `/products/${p.slug}` : null };
  });
  const pairing = all.map((p) => ({ p, uses: DISHES.map((d) => d.match.test(p.description)) }));

  const payment = [razorpayConfigured() && "secure online payment (UPI, cards, net banking and wallets via Razorpay)", commerce.codEnabled && "cash on delivery"].filter(Boolean).join(" or ");
  const faq: FaqItem[] = [
    {
      q: "How do I place an order?",
      a: (
        <>
          Add your favourite spices to the cart and check out with a free account{payment ? ` — pay by ${payment}` : ""}.
          {commerce.whatsappOrdering && <> You can also send your cart to us on <a className="font-medium text-green-600 underline" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>.</>}
        </>
      ),
    },
    {
      q: "What does delivery cost?",
      a: commerce.shippingConfigured
        ? commerce.shippingFlatPaise === 0
          ? "Delivery is free of charge."
          : `Standard delivery is ${formatINR(commerce.shippingFlatPaise)}${commerce.freeShippingAbovePaise !== null ? `, and free on orders above ${formatINR(commerce.freeShippingAbovePaise)}` : ""}. The exact amount is always shown at checkout.`
        : "The delivery charge for your address is shown at checkout before you pay.",
    },
    { q: "How should I store whole spices?", a: "Keep them in an airtight container in a cool, dry place away from sunlight and moisture. Grind or crush whole spices just before cooking for the boldest aroma." },
    { q: "Can I track or cancel my order?", a: "Yes. Every order appears under My account → Orders with its status, and courier tracking once shipped. Orders that haven't shipped can be cancelled from the same page; paid orders are refunded once the cancellation is approved." },
    { q: "Where are you based?", a: <>We&apos;re in {contact.addressLines.slice(0, 3).join(", ")}. Write to <a className="font-medium text-green-600 underline" href={`mailto:${contact.email}`}>{contact.email}</a> or call {contact.phone}.</> },
  ];

  return (
    <>
      <Hero
        eyebrow={content.heroEyebrow}
        line1={content.heroLine1}
        line2={content.heroLine2}
        text={content.heroText}
        annotations={content.annotations}
        whatsapp={contact.whatsapp}
        products={collection
          .filter((p) => p.images[0] && p.variants[0])
          .map((p) => ({ slug: p.slug, name: shortSpiceName(p.name), label: p.variants[0].label, image: p.images[0].url, pricePaise: p.variants[0].pricePaise }))}
      />

      {/* 01 · The collection — products first */}
      <section aria-labelledby="collection" className="paper relative overflow-hidden">
        <SpiceBackdrop
          items={[
            { kind: "leaf", className: "-left-10 top-24 w-20 rotate-[35deg] md:w-28", depth: 0.8 },
            { kind: "star", className: "right-[4%] top-10 w-16 md:w-24", depth: 0.5 },
            { kind: "cardamom", className: "-right-2 bottom-40 w-10 -rotate-12 md:w-12", depth: 0.7 },
          ]}
        />
        <div className="container-x relative py-24 md:py-32">
          <SectionHead index="01" eyebrow="The collection" title="Our whole" accent="spices." id="collection">
            <p>Carefully selected spices with rich aroma and authentic flavour — sealed for freshness and ready for your kitchen.</p>
            <Link href="/shop" className="link-underline mt-4 inline-flex items-center gap-2 font-medium text-forest-800">
              Shop all products <ArrowRight className="size-4" />
            </Link>
          </SectionHead>
          <Reveal className="mt-16 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-8">
            {collection.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i + 1} priority={i < 2} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* 02 · Brand moment around the "heart of spices" photo */}
      <section aria-label="A handful of good things" className="paper pb-2 md:pb-3">
        <HandfulFeature spices={handful} />
      </section>

      {/* 03 · Promise */}
      <section aria-labelledby="promise" className="paper relative overflow-hidden">
        <div className="container-x relative py-24 md:py-32">
          <SectionHead index="02" eyebrow="Why Driponza" title="Good food begins with" accent="good ingredients." id="promise" center />
          <Reveal className="mt-10 grid grid-cols-2 gap-3 md:mt-16 md:gap-4 lg:grid-cols-4">
            {PROMISE.map(({ title, text, Icon }, i) => (
              <div key={title} className="group relative overflow-hidden rounded-[20px] border border-cream-200 bg-white p-4 transition sm:p-7 md:rounded-[26px] duration-500 hover:-translate-y-1 hover:border-sage-400 hover:shadow-[0_30px_50px_-34px_rgba(18,61,34,0.5)]">
                <span className="section-index absolute right-4 top-4 text-xs text-ink-500 sm:right-6 sm:top-6 sm:text-sm">{String(i + 1).padStart(2, "0")}</span>
                <span className="hero-surface grain relative grid size-12 place-items-center overflow-hidden rounded-[14px] sm:size-20 sm:rounded-[22px]">
                  <Icon uid={`pr${i}`} className="h-8 w-auto drop-shadow sm:h-14-[0_6px_8px_rgba(0,0,0,0.35)] transition duration-700 group-hover:rotate-[20deg] group-hover:scale-110" />
                </span>
                <h3 className="display mt-4 text-[21px] leading-tight sm:mt-7 sm:text-3xl">{title}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-700 sm:mt-3 sm:text-[15px]">{text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 04 · Story */}
      <section aria-labelledby="story" className="paper px-2 md:px-3">
        <div className="paper-green relative overflow-hidden rounded-[var(--radius-panel)]">
          <SpiceBackdrop glow={false} items={[{ kind: "cinnamon", className: "-right-16 -top-6 w-72 rotate-[20deg]", depth: 0.6 }]} />
          <div className="container-x relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-20">
            <div className="relative">
              <ParallaxMedia className="relative aspect-[4/5] overflow-hidden rounded-[26px] shadow-[0_40px_70px_-40px_rgba(18,61,34,0.7)]">
                <div className="absolute inset-0">
                  <Image src="/images/products/60c7769efa196c3e6be41ca1bb1e963b.jpg" alt="Green cardamom pods in a wooden bowl and scoop" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
                </div>
              </ParallaxMedia>
              <p className="absolute -bottom-5 left-6 rotate-[-4deg] rounded-full bg-ivory-50 px-5 py-2 font-[family-name:var(--font-script)] text-2xl text-green-600 shadow-lg">Nurture • Grow • Thrive</p>
            </div>
            <div>
              <p className="flex items-center gap-3">
                <span className="section-index">(03)</span>
                <span className="h-px w-8 bg-green-600/40" />
                <span className="eyebrow text-green-600">Our story</span>
              </p>
              <h2 id="story" className="display mt-5 text-[clamp(2.6rem,5vw,4.4rem)]">
                The right spice can make <em className="text-green-600">the ordinary extraordinary.</em>
              </h2>
              <p className="mt-6 max-w-lg leading-relaxed text-ink-700">{content.storyText}</p>
              <ul className="mt-8 space-y-3">
                {["Carefully selected spices", "Authentic aroma and flavour", "Packed with care"].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[15px]">
                    <span className="grid size-6 place-items-center rounded-full bg-green-600 text-ivory-50"><Check className="size-3.5" /></span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/our-story" className="btn btn-primary px-7 py-4">Read our story</Link>
                <Link href="/contact" className="btn btn-outline px-7 py-4 text-forest-800">Get in touch</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05 · Pairing guide */}
      <section aria-labelledby="pairing" className="paper relative overflow-hidden">
        <SpiceBackdrop items={[{ kind: "star", className: "-left-8 bottom-24 w-24", depth: 0.6 }, { kind: "cardamom", className: "right-[6%] top-20 w-10 rotate-[30deg]", depth: 0.5 }]} />
        <div className="container-x relative py-24 md:py-32">
          <SectionHead index="04" eyebrow="Pairing guide" title="Which spice" accent="goes where?" id="pairing">
            <p>A quick guide drawn from the uses we list for each Driponza spice — from biryani and curries to chai and desserts.</p>
          </SectionHead>
          <Reveal className="mt-14">
            <div className="overflow-x-auto rounded-[26px] border border-cream-200 bg-white shadow-[0_30px_60px_-45px_rgba(18,61,34,0.5)]">
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cream-200">
                    <th scope="col" className="px-7 py-6 text-left"><span className="eyebrow text-[10px] text-ink-500">Spice</span></th>
                    {DISHES.map((d, i) => (
                      <th key={d.label} scope="col" className={cn("px-3 py-6 text-center", i === 0 && "bg-botanical-100")}>
                        <span className="display block text-xl leading-tight">{d.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pairing.map(({ p, uses }) => (
                    <tr key={p.id} className="border-b border-cream-100 last:border-0 hover:bg-ivory-50">
                      <th scope="row" className="px-7 py-4 text-left">
                        <Link href={`/products/${p.slug}`} className="flex items-center gap-3 font-medium text-forest-800 hover:text-green-600">
                          <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-cream-100">
                            {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="36px" loading="eager" className="object-cover" />}
                          </span>
                          {shortSpiceName(p.name)}
                        </Link>
                      </th>
                      {uses.map((u, i) => (
                        <td key={i} className={cn("px-3 py-4 text-center", i === 0 && "bg-botanical-100/70")}>
                          {u ? (
                            <span className="inline-grid size-7 place-items-center rounded-full bg-green-600 text-ivory-50" aria-label="Yes"><Check className="size-3.5" strokeWidth={3} /></span>
                          ) : (
                            <span className="text-ink-500/40" aria-label="Not listed">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-500 md:hidden">Swipe the table to see every dish →</p>
          </Reveal>
        </div>
      </section>

      {/* 06 · Spice kitchen */}
      <section aria-labelledby="kitchen" className="paper px-2 md:px-3">
        <div className="paper-green relative overflow-hidden rounded-[var(--radius-panel)]">
          <div className="container-x relative py-20 md:py-28">
            <SectionHead index="05" eyebrow="The spice kitchen" title="Cook with" accent="whole spices." id="kitchen">
              <p>Simple ideas for getting the most out of every pod, stick and seed.</p>
            </SectionHead>
            <Reveal className="no-scrollbar -mx-4 mt-14 flex snap-x gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
              {KITCHEN.map((k, i) => (
                <article key={k.title} className="group flex w-[78vw] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-[26px] border border-forest-800/10 bg-white transition duration-500 hover:-translate-y-1 hover:shadow-[0_34px_60px_-40px_rgba(18,61,34,0.7)] md:w-auto md:max-w-none">
                  <div className="hero-surface grain relative h-48 overflow-hidden">
                    <div className="absolute inset-0 transition duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-110">
                      <KitchenArt kind={k.art} uid={`k${i}`} />
                    </div>
                    <span className="section-index absolute left-5 top-4 text-ivory-50/80">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="display text-[28px] leading-tight">{k.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-700">{k.tip}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                      {k.spices.map((sp) => {
                        const p = findBySpice(all, sp);
                        return p ? (
                          <Link key={sp} href={`/products/${p.slug}`} className="rounded-full border border-forest-800/15 px-3 py-1 text-[11px] capitalize text-forest-800 transition hover:border-green-600 hover:bg-green-600 hover:text-ivory-50">{sp}</Link>
                        ) : (
                          <span key={sp} className="rounded-full border border-cream-200 px-3 py-1 text-[11px] capitalize text-ink-500">{sp}</span>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* 07 · FAQ */}
      <section aria-labelledby="faq" className="paper relative overflow-hidden">
        <SpiceBackdrop mobile={false} items={[{ kind: "nutmeg", className: "-left-8 bottom-16 w-24", depth: 0.5 }, { kind: "leaf", className: "-right-6 bottom-10 w-16 -rotate-[40deg]", depth: 0.4 }]} />
        <div className="container-x relative grid gap-12 py-24 md:py-32 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="flex items-center gap-3">
              <span className="section-index">(06)</span>
              <span className="h-px w-8 bg-green-600/40" />
              <span className="eyebrow text-green-600">Questions</span>
            </p>
            <h2 id="faq" className="display mt-5 text-[clamp(2.6rem,5vw,4.4rem)]">
              You ask, <em className="text-green-600">we answer.</em>
            </h2>
            <div className="mt-8 rounded-[26px] border border-cream-200 bg-white p-6">
              <p className="font-[family-name:var(--font-script)] text-2xl text-green-600">Still curious?</p>
              <p className="mt-2 text-sm text-ink-700">We&apos;re happy to help with orders and bulk requirements.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">WhatsApp us</a>
                <Link href="/contact" className="btn btn-outline btn-sm text-forest-800">Contact</Link>
              </div>
            </div>
          </div>
          <Faq items={faq} />
        </div>
      </section>

      {/* 08 · Closing CTA (unchanged) */}
      <section className="paper px-2 pb-2 md:px-3 md:pb-3">
        <FinalCta title={content.ctaTitle} text={content.ctaText} />
      </section>
    </>
  );
}
