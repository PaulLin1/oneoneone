import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center sm:px-10">
      <h1 className="text-3xl tracking-tight sm:text-4xl">404</h1>
      <p className="max-w-sm font-serif text-base leading-relaxed text-ink-soft">
        Nothing here — the page you&apos;re looking for doesn&apos;t exist, or moved.
      </p>
      <Link
        href="/"
        className="rounded-full border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
      >
        Back to today
      </Link>
    </main>
  );
}
