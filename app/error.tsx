"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center sm:px-10">
      <h1 className="text-3xl tracking-tight sm:text-4xl">Something went wrong</h1>
      <p className="max-w-sm font-serif text-base leading-relaxed text-ink-soft">
        That&apos;s on us, not you. Try again, or head back to today&apos;s reading.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-ink/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:border-ink"
        >
          Back to today
        </Link>
      </div>
    </main>
  );
}
