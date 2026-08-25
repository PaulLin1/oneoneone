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
            Privacy without an account
          </h2>
          <p className="mt-3">
            You don&apos;t need an account to read oneoneone (see below). If you don&apos;t have
            one, we don&apos;t store anything about you. The only thing saved is one entry in your
            browser&apos;s <code className="font-sans text-sm">localStorage</code>, which caches
            today&apos;s picks so a refresh doesn&apos;t re-fetch them. That entry never leaves
            your device. We don&apos;t run analytics, cookies, read-tracking, or third-party
            scripts. The Share button just uses your device&apos;s own share sheet or clipboard,
            so nothing routes through us.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Privacy with an account
          </h2>
          <p className="mt-3">
            Signing in with Google stores your name, email, and profile photo from Google, plus a
            session cookie to keep you signed in. After that, we log which works you open while
            signed in, and you can see that list on your{" "}
            <Link
              href="/account"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              account page
            </Link>
            . Nothing from before you signed up gets added retroactively. A work you recommend is
            tied to your account too, so a reviewer can follow up if they have questions. We
            don&apos;t run analytics or use any third-party tool beyond Google&apos;s sign-in.
            The data stays in our database, visible only to you and, for recommendations, whoever
            is reviewing the queue.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Terms
          </h2>
          <p className="mt-3">
            Every text on oneoneone is public domain. See{" "}
            <Link
              href="/about"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              About
            </Link>{" "}
            for how we check that. We don&apos;t claim any rights over the works themselves; read,
            copy, or share them freely, they were already yours. The selection, design, and code
            that bring you today&apos;s three are provided as-is. We&apos;re careful sourcing and
            transcribing everything, but if you spot an error in a 150-year-old scan, let us know
            rather than assume we meant it.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Questions
          </h2>
          <p className="mt-3">
            Email{" "}
            <a
              href="mailto:hello@readoneoneone.com"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              hello@readoneoneone.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
