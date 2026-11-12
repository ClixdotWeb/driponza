import Link from "next/link";
import { StarAnise } from "@/components/spices/Spices";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-3">
      <div className="hero-surface grain relative flex min-h-[calc(100svh-24px)] w-full flex-col items-center justify-center overflow-hidden rounded-[var(--radius-panel)] px-6 text-center text-ivory-50">
        <StarAnise uid="nf" className="mb-6 w-24 drop-shadow-2xl" />
        <p className="font-[family-name:var(--font-script)] text-3xl text-leaf-200">Lost the scent?</p>
        <h1 className="display mt-2 text-[clamp(3rem,10vw,7rem)]">Page not found</h1>
        <p className="mt-4 max-w-md text-ivory-50/75">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-ivory">Back home</Link>
          <Link href="/shop" className="btn btn-leaf">Shop spices</Link>
        </div>
      </div>
    </main>
  );
}
