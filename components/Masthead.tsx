import Link from "next/link";
import { auth, signIn } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

// Outlined pill — same recipe as linpaul.com's nav (styles/globals.css
// .site-nav a): paper fill, 1px ink border, ink text, --tile-hover on hover.
// Padding/font-size/gap are linpaul's exact numbers too (--step--1, from
// design-system/tokens.css) — the whole masthead is meant to look like one
// component across all three sites, not a per-project reskin.
const CHIP =
  "-my-2 rounded-full border border-ink bg-paper px-3 py-[0.2rem] text-[length:var(--step--1)] text-ink transition-colors hover:bg-[var(--tile-hover)]";

/**
 * Async server component — reads the session directly via auth() rather
 * than taking it as a prop, since it's the only thing on the page that
 * needs it. Accounts are entirely opt-in (see README's "Accounts"
 * section): a signed-out visitor sees exactly what this header showed
 * before accounts existed, plus one "Sign in" chip.
 */
export async function Masthead() {
  const session = await auth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-ink bg-paper px-6 sm:px-10">
      <Link
        href="/"
        className="-my-2 py-2 text-[length:var(--step-1)] leading-[1.15] tracking-[-0.01em]"
      >
        {/* One accent per "one" — poem, essay, story, in that order, matching
            the app icon and every category-color mapping in the app. The only
            color in the masthead; the bar itself stays paper/ink. */}
        <span className="text-cyan">one</span>
        <span className="text-red">one</span>
        <span className="text-iris">one</span>
      </Link>
      <div className="flex items-center gap-[0.35rem]">
        {/* Relocated here when the footer was removed — still deliberately
            inconspicuous, an icon among the chips. */}
        <span className="mr-0.5 flex items-center text-ink-soft">
          <ThemeToggle />
        </span>
        <Link href="/archive" className={CHIP}>
          Archive
        </Link>
        {session?.user ? (
          <Link href="/account" className={CHIP}>
            Account
          </Link>
        ) : (
          <form
            // display: contents drops the form out of the flex box tree so
            // the button becomes a direct flex item, sized/aligned exactly
            // like the Link chips beside it — without this, the form's own
            // untouched box (the CHIP class's -my-2 only shrinks the
            // button, not its form wrapper) throws off height and
            // vertical alignment in the row.
            className="contents"
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button type="submit" className={CHIP}>
              Sign in
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
