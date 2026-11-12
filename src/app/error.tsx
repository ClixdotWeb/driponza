"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70svh] place-items-center px-6 text-center">
      <div>
        <h1 className="display text-5xl">Something went wrong</h1>
        <p className="mt-3 text-ink-500">Please try again. If the problem continues, contact us.{error.digest && <span className="block text-xs">Ref: {error.digest}</span>}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-outline text-forest-800">Home</Link>
        </div>
      </div>
    </main>
  );
}
