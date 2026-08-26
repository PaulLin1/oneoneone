import Link from "next/link";
import { auth, signIn } from "@/lib/auth";

// Solid color chips, not underlined text — the same flat-block language
// already used everywhere else (category badges in CategoryColumn/
// ReadingView, the yellow CTA buttons): no rounded corners, no underline,
// bold uppercase on a hard color fill. One accent per link so the nav
// reads as a row of marks, same idea as the "one/one/one" wordmark itself.
//
// Literal bg-black/text-yellow, not bg-ink/text-* — this header bar is
// always yellow regardless of theme, so its chips need a fixed dark fill
// too; bg-ink would flip to near-white in dark mode and leave yellow text
// stranded on a pale chip.
const CHIP =
  "-my-2 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] transition-opacity hover:opacity-70 sm:px-3 sm:text-xs bg-black text-yellow";

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-ink bg-yellow px-6 sm:px-10">
      <Link href="/" className="-my-2 py-2 text-base tracking-tight">
        {/* One color per "one" — poem, essay, story, in that order, matching
            the app icon and every other category-color mapping in the app. */}
        <span className="text-blue">one</span>
        <span className="text-pink">one</span>
        <span className="text-purple">one</span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2">
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
