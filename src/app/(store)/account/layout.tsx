import { AccountNav } from "@/components/store/AccountNav";
import { requireUser } from "@/lib/auth/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <section className="container-x py-10 md:py-14">
      <p className="eyebrow text-green-600">My account</p>
      <h1 className="display mt-3 text-[clamp(2.6rem,5vw,4.2rem)]">Hello, {user.name.split(" ")[0]}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <AccountNav isAdmin={user.role === "ADMIN"} />
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
