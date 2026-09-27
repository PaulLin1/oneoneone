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
        <div className="mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
      </div>

      <div className="space-y-10 pt-10 font-serif text-base leading-relaxed">
        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
            Privacy without an account
          </h2>
          <p className="mt-3">
            You don&apos;t need an account to read oneoneone. Without one, we don&apos;t store
            anything that identifies you. We
            do use Vercel Analytics to see aggregate page-view counts, it doesn&apos;t use cookies
            or track you individually, and we don&apos;t run anything else: no ad trackers, no
            read-tracking, no other third-party scripts.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
            Privacy with an account
          </h2>
          <p className="mt-3">
            Signing in with Google gives us your name, email, and profile photo, kept only in a
            signed session cookie on your device so you stay signed in. We don&apos;t keep a copy
            on our servers, and signing out clears it.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
            Terms
          </h2>
          <p className="mt-3">
            Every text on oneoneone is public domain. See{" "}
            <Link
              href="/about"
              className="text-ink underline decoration-ink/20 underline-offset-4 transition-colors hover:decoration-ink"
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
            <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
            Questions
          </h2>
          <p className="mt-3">
            Email{" "}
            <a
              href="mailto:hello@readoneoneone.com"
              className="text-ink underline decoration-ink/20 underline-offset-4 transition-colors hover:decoration-ink"
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
