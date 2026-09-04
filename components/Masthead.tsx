import Link from "next/link";
import { auth, signIn } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

// Solid chips, not underlined text — a hard fill, no rounded corners, no
// underline. Black on white now (the chrome is b/w only — no accent touches
// the masthead), so bg-ink/text-paper: it flips correctly with the theme.
// The `font-semibold uppercase tracking-[0.15em]` classes are inert — the
// type law in app/globals.css collapses weight, case and letterspacing — but
// left in place so the markup matches its siblings.
const CHIP =
  "-my-2 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] transition-opacity hover:opacity-70 sm:px-3 sm:text-xs bg-ink text-paper";

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
      <Link href="/" className="-my-2 py-2 text-base tracking-tight">
        {/* One accent per "one" — poem, essay, story, in that order, matching
            the app icon and every category-color mapping in the app. The only
            color in the masthead; the bar itself stays paper/ink. */}
        <span className="text-cyan">one</span>
        <span className="text-red">one</span>
        <span className="text-iris">one</span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Relocated here when the footer was removed — still deliberately
            inconspicuous, an icon among the chips. */}
        <span className="mr-0.5 flex items-center text-ink-soft sm:mr-1">
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
