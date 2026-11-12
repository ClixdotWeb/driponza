import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { HeaderActions, MobileMenu, NavDropdown } from "@/components/store/HeaderClient";
import type { SessionUser } from "@/lib/auth/session";

type Category = { name: string; slug: string; count: number };

export function Header({ user, categories }: { user: SessionUser | null; categories: Category[] }) {
  const nav = [
    { href: "/our-story", label: "Our Story" },
    { href: "/contact", label: "Contact" },
  ];
  return (
    <header className="sticky top-0 z-50 bg-ivory-50/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 md:h-[72px] md:px-8">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 text-[13px] text-ink-700 lg:flex">
          <Link href="/" className="link-underline py-1 hover:text-forest-800">
            Home
          </Link>
          <NavDropdown label="Shop" categories={categories} />
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="link-underline py-1 hover:text-forest-800">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <HeaderActions user={user} />
          <MobileMenu user={user} categories={categories} links={[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop all" }, ...nav]} />
        </div>
      </div>
    </header>
  );
}
