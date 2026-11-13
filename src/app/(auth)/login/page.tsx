import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/store/AuthShell";
import { LoginForm } from "@/components/store/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(next, user.role === "ADMIN" ? "/admin" : "/account"));
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to check out, track orders and save favourites.">
      <LoginForm next={next ? safeRedirect(next) : undefined} />
    </AuthShell>
  );
}
