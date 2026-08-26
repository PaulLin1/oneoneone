import Link from "next/link";

/**
 * Persistent, global — sits alongside the Masthead in the root layout on
 * every page, not appended per-page. Kept compact on purpose: it's always
 * on screen, including on the reading pages, so it can't cost much height.
 */
export function Footer() {
  return (
    <footer className="shrink-0 border-t border-ink/10 px-6 py-2.5 text-right text-[0.7rem] text-ink-soft sm:px-10">
      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 uppercase tracking-[0.1em]">
        <Link href="/about" className="transition-colors hover:text-ink">
          About
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-ink">
          Privacy &amp; Terms
        </Link>
        <span className="normal-case tracking-normal">© {new Date().getFullYear()} oneoneone</span>
      </nav>
    </footer>
  );
}
