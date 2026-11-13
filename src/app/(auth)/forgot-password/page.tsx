import type { Metadata } from "next";
import { AuthShell } from "@/components/store/AuthShell";
import { ForgotForm } from "@/components/store/AuthForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a link to set a new password.">
      <ForgotForm />
    </AuthShell>
  );
}
