import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/store/AccountForms";
import { DeleteAccountForm, PreferencesForm, VerifyBanner } from "@/components/store/AccountExtras";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string; verified?: string }> }) {
  const user = await requireUser("/account");
  const { reset, verified } = await searchParams;
  const extra = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true, marketingOptIn: true, deletionRequestedAt: true } });
  return (
    <div className="grid gap-6">
      {reset && <p className="rounded-xl bg-botanical-100 px-4 py-3 text-sm text-forest-800">Your password has been updated.</p>}
      {verified && <p className="rounded-xl bg-botanical-100 px-4 py-3 text-sm text-forest-800">Thanks – your email address is confirmed.</p>}
      {!extra.emailVerifiedAt && !verified && <VerifyBanner />}
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Profile</h2>
        <div className="mt-6"><ProfileForm name={user.name} phone={user.phone} email={user.email} /></div>
      </section>
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Password</h2>
        <div className="mt-6"><PasswordForm /></div>
      </section>
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Email preferences</h2>
        <div className="mt-6"><PreferencesForm marketing={extra.marketingOptIn} /></div>
      </section>
      <section className="card p-6 md:p-8">
        <h2 className="display text-3xl">Delete account</h2>
        <div className="mt-6"><DeleteAccountForm requested={Boolean(extra.deletionRequestedAt)} /></div>
      </section>
    </div>
  );
}
