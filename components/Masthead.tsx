import Link from "next/link";
import { auth, signIn } from "@/lib/auth";

const NAV_LINK = "-my-2 py-2 underline decoration-black/40 underline-offset-4 transition-colors hover:decoration-black";

/**
 * Async server component — reads the session directly via auth() rather
 * than taking it as a prop, since it's the only thing on the page that
 * needs it. Accounts are entirely opt-in (see README's "Accounts"
 * section): a signed-out visitor sees exactly what this header showed
 * before accounts existed, plus one "Sign in" link.
 */
export async function Masthead() {
  const session = await auth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink bg-yellow px-6 sm:px-10">
      <Link href="/" className="-my-2 py-2 text-base tracking-tight">
        {/* One color per "one" — poem, essay, story, in that order, matching
            the app icon and every other category-color mapping in the app. */}
        <span className="text-blue">one</span>
        <span className="text-pink">one</span>
        <span className="text-purple">one</span>
      </Link>
      <div className="flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.15em] text-black">
        <Link href="/archive" className={NAV_LINK}>
          Archive
        </Link>
        <Link href="/about" className={NAV_LINK}>
          About
        </Link>
        <Link href="/recommend" className={NAV_LINK}>
          Recommend
        </Link>
        {session?.user ? (
          <Link href="/account" className={NAV_LINK}>
            Account
          </Link>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button type="submit" className={NAV_LINK}>
              Sign in
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
