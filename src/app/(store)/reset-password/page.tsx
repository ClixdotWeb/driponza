import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/store/AuthShell";
import { ResetForm } from "@/components/store/AuthForms";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="New password" subtitle="Choose a new password for your account.">
      {token ? <ResetForm token={token} /> : (
        <p className="text-sm text-ink-700">This link is incomplete. <Link href="/forgot-password" className="text-green-600 underline">Request a new reset link</Link>.</p>
      )}
    </AuthShell>
  );
}
