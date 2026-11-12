import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailToken } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (token && (await verifyEmailToken(token))) redirect("/account?verified=1");
  return (
    <section className="container-x py-20">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="display text-4xl">Link expired</h1>
        <p className="mt-3 text-sm text-ink-700">This confirmation link is invalid or has already been used. Sign in and use “Resend link” on your account page.</p>
        <Link href="/account" className="btn btn-primary mt-6">Go to my account</Link>
      </div>
    </section>
  );
}
