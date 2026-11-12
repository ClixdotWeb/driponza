import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/store/AuthShell";
import { RegisterForm } from "@/components/store/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeRedirect(next, "/account"));
  return (
    <AuthShell title="Create account" subtitle="Faster checkout, order tracking and a wishlist of your favourite spices.">
      <RegisterForm next={next ? safeRedirect(next) : undefined} />
    </AuthShell>
  );
}
