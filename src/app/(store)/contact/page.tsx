import type { Metadata } from "next";
import { Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "@/components/store/PageHero";
import { Reveal } from "@/components/motion/Reveal";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with Driponza – Kozhikode, Kerala." };

export default async function ContactPage() {
  const { contact } = await getSettings();
  const cards = [
    { icon: MessageCircle, title: "WhatsApp", body: "Questions or orders — message us anytime.", href: `https://wa.me/${contact.whatsapp}`, cta: "Chat on WhatsApp", external: true },
    { icon: Phone, title: "Phone", body: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}`, cta: "Call us" },
    { icon: Mail, title: "Email", body: contact.email, href: `mailto:${contact.email}`, cta: "Send an email" },
    ...(contact.website ? [{ icon: Globe, title: "Website", body: contact.website, href: `https://${contact.website.replace(/^https?:\/\//, "")}`, cta: "Visit", external: true }] : []),
  ];
  return (
    <>
      <PageHero eyebrow="Contact" title={<>We&apos;d love to <em className="text-leaf-200">hear from you</em></>}>
        Questions about our spices, an order or bulk requirements — reach out and we&apos;ll get back to you.
      </PageHero>
      <section className="container-x grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1.2fr]">
        <div className="hero-surface grain relative overflow-hidden rounded-[var(--radius-panel)] p-8 text-ivory-50 md:p-12">
          <MapPin className="size-7 text-leaf-300" />
          <h2 className="display mt-4 text-4xl">Visit us</h2>
          <address className="mt-4 not-italic leading-relaxed text-ivory-50/85">
            Driponza
            {contact.addressLines.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
          </address>
          <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-leaf mt-8">Open in Google Maps</a>
        </div>
        <Reveal className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <a key={c.title} href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined} className="card group flex flex-col p-6 transition hover:border-sage-400">
              <c.icon className="size-6 text-green-600" />
              <h3 className="display mt-4 text-3xl">{c.title}</h3>
              <p className="mt-2 break-words text-sm text-ink-700">{c.body}</p>
              <span className="mt-auto pt-6 text-sm font-medium text-green-600 group-hover:underline">{c.cta} →</span>
            </a>
          ))}
        </Reveal>
      </section>
    </>
  );
}
