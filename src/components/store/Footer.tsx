import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import type { Settings } from "@/lib/settings";

export function Footer({ settings, categories }: { settings: Settings; categories: { name: string; slug: string }[] }) {
  const { contact } = settings;
  const socials = [
    { label: "Instagram", href: contact.instagram },
    { label: "Facebook", href: contact.facebook },
    { label: "YouTube", href: contact.youtube },
  ].filter((s) => s.href);

  return (
    <footer className="px-2 pb-2 text-forest-900 md:px-3 md:pb-3">
      <div className="paper-green relative overflow-hidden rounded-[var(--radius-panel)]">
      <div className="container-x grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          <Logo tone="green" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-forest-800/75">
            Finest spices, thoughtfully selected. Bringing natural aroma, authentic taste and quality to your kitchen.
          </p>
          <p className="mt-6 font-[family-name:var(--font-script)] text-3xl text-green-600">Nurture • Grow • Thrive</p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:col-span-4">
          <div>
            <h3 className="eyebrow text-green-600">Shop</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-forest-800/80">
              <li><Link href="/shop" className="link-underline hover:text-green-600">All products</Link></li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/shop?category=${c.slug}`} className="link-underline hover:text-green-600">{c.name}</Link>
                </li>
              ))}
              <li><Link href="/wishlist" className="link-underline hover:text-green-600">Wishlist</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="eyebrow text-green-600">Explore</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-forest-800/80">
              <li><Link href="/our-story" className="link-underline hover:text-green-600">Our story</Link></li>
              <li><Link href="/contact" className="link-underline hover:text-green-600">Contact</Link></li>
              <li><Link href="/account" className="link-underline hover:text-green-600">My account</Link></li>
              <li><Link href="/account/orders" className="link-underline hover:text-green-600">Track an order</Link></li>
            </ul>
            <h3 className="eyebrow mt-8 text-green-600">Policies</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-forest-800/80">
              <li><Link href="/policies/shipping" className="link-underline hover:text-green-600">Shipping</Link></li>
              <li><Link href="/policies/returns" className="link-underline hover:text-green-600">Returns & refunds</Link></li>
              <li><Link href="/policies/privacy" className="link-underline hover:text-green-600">Privacy</Link></li>
              <li><Link href="/policies/terms" className="link-underline hover:text-green-600">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-4">
          <h3 className="eyebrow text-green-600">Get in touch</h3>
          <ul className="mt-4 space-y-3 text-sm text-forest-800/85">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-green-600" />
              <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-green-600">
                {contact.addressLines.map((l) => (
                  <span key={l} className="block">{l}</span>
                ))}
              </a>
            </li>
            <li className="flex gap-3">
              <Phone className="size-4 shrink-0 text-green-600" />
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-green-600">{contact.phone}</a>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="size-4 shrink-0 text-green-600" />
              <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600">WhatsApp us</a>
            </li>
            <li className="flex gap-3">
              <Mail className="size-4 shrink-0 text-green-600" />
              <a href={`mailto:${contact.email}`} className="break-all hover:text-green-600">{contact.email}</a>
            </li>
          </ul>
          <div className="mt-8">
            <h3 className="eyebrow text-green-600">Newsletter</h3>
            <p className="mt-2 text-sm text-forest-800/75">New harvests and offers, now and then.</p>
            <NewsletterForm />
          </div>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="chip text-forest-800 hover:bg-forest-800 hover:text-ivory-50">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-forest-800/15">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-forest-800/60 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} Driponza. All rights reserved.</span>
          <span>Pure Spices. Bold Flavour.</span>
        </div>
      </div>
      </div>
    </footer>
  );
}
