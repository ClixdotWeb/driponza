// Sign-in / registration pages stand on their own: no store header or footer.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="min-h-svh bg-ivory-50">{children}</main>;
}
