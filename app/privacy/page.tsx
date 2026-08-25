import Link from "next/link";
import { globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";

export default function PrivacyPage() {
  const currentDay = globalDayNumber(todayIso());

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <Link href="/" className="text-sm text-ink-soft transition-colors hover:text-ink">
          ← No. {currentDay}
        </Link>
        <h1 className="mt-4 text-3xl tracking-tight sm:text-4xl">Privacy &amp; Terms</h1>
        <div className="mt-3 h-1.5 w-16 bg-yellow" aria-hidden="true" />
      </div>

      <div className="space-y-10 border-t border-black/15 pt-10 font-serif text-base leading-relaxed">
        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Privacy — without an account
          </h2>
          <p className="mt-3">
            An account is entirely optional (see below) — you never need one to read. Without
            one, there&apos;s nothing to store about you. The only thing this site writes to your
            browser is a single entry in <code className="font-sans text-sm">localStorage</code>{" "}
            caching today&apos;s selection, so refreshing the page doesn&apos;t re-fetch it — that
            entry never leaves your device. No analytics, no cookies, no tracking of what
            you&apos;ve read, no third-party scripts. If you use the Share button, whatever you
            send is handled entirely by your own device&apos;s share sheet or clipboard; nothing
            routes through this site.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Privacy — with an account
          </h2>
          <p className="mt-3">
            Making an account (Google sign-in only) is the one thing on this site that stores
            something about you: your name, email, and Google profile image as returned by
            Google, a session cookie so you stay signed in, and — from that point on — a record
            of which works you open while signed in, shown back to you on your{" "}
            <Link
              href="/account"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              account page
            </Link>
            . Nothing before you signed up is backfilled. A recommendation you submit is tied to
            your account (so a reviewer can follow up on it) the same way. There&apos;s no
            analytics platform and no third party involved beyond Google&apos;s own sign-in
            flow — the data stays in this site&apos;s database, readable only by you and, for
            recommendations, whoever reviews the queue.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Terms
          </h2>
          <p className="mt-3">
            Every text on oneoneone is in the public domain — see{" "}
            <Link
              href="/about"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              About
            </Link>{" "}
            for how that&apos;s verified. oneoneone claims no rights over the works themselves;
            read, copy, or share them freely, they were already yours. The selection, design, and
            code that put those three pieces in front of you today are provided as-is — sourced
            and transcribed carefully, but if you spot an error in a 150-year-old scan, tell us
            rather than assume it&apos;s intentional.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Questions
          </h2>
          <p className="mt-3">
            <a
              href="mailto:hello@oneoneone.com"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              hello@oneoneone.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
