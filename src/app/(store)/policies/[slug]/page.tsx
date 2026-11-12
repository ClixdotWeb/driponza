import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/store/PageHero";
import { getSettings } from "@/lib/settings";

const TITLES = { privacy: "Privacy policy", terms: "Terms & conditions", shipping: "Shipping policy", returns: "Returns & refunds" } as const;
type Slug = keyof typeof TITLES;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: TITLES[slug as Slug] ?? "Policy" };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in TITLES)) notFound();
  const { policies, contact } = await getSettings();
  const body = policies[slug as Slug];

  return (
    <>
      <PageHero eyebrow="Policies" title={TITLES[slug as Slug]} />
      <section className="container-x max-w-3xl py-16">
        {body ? (
          <div className="prose-policy">
            {/* Plain text from the admin panel: blank lines become paragraphs, "## " lines become headings. Rendered as text (no HTML) to prevent XSS. */}
            {body.split(/\n{2,}/).map((block, i) =>
              block.startsWith("## ") ? <h2 key={i}>{block.slice(3)}</h2> : <p key={i} className="whitespace-pre-line">{block}</p>,
            )}
          </div>
        ) : (
          <div className="rounded-[22px] bg-cream-100 p-8 text-ink-700">
            <p>This policy is being finalised.</p>
            <p className="mt-2">For any questions in the meantime, contact us at <a className="text-green-600 underline" href={`mailto:${contact.email}`}>{contact.email}</a> or on <a className="text-green-600 underline" href={`https://wa.me/${contact.whatsapp}`}>WhatsApp</a>.</p>
          </div>
        )}
      </section>
    </>
  );
}
