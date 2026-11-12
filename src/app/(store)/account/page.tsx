import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/store/AccountForms";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await requireUser("/account");
  const { reset } = await searchParams;
  return (
    <div className="grid gap-6">
      {reset && <p className="rounded-xl bg-botanical-100 px-4 py-3 text-sm text-forest-800">Your password has been updated.</p>}
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Profile</h2>
        <div className="mt-6"><ProfileForm name={user.name} phone={user.phone} email={user.email} /></div>
      </section>
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Password</h2>
        <div className="mt-6"><PasswordForm /></div>
      </section>
    </div>
  );
}
