import Link from "next/link";
import { getDb } from "@/lib/db";
import { buildArchiveDays } from "@/lib/archive";
import { globalDayNumber } from "@/lib/epoch";
import { todayIso, formatDisplayDate } from "@/lib/dateMath";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { Work, WorkCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};

// The archive's content depends on "today" — never freeze it at build time.
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const sql = getDb();
  const works = (await sql`select * from works_feed where is_active = true`) as unknown as Work[];
  const days = buildArchiveDays(works);
  const currentDay = globalDayNumber(todayIso());

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <Link href="/" className="text-sm text-ink-soft transition-colors hover:text-ink">
          ← No. {currentDay}
        </Link>
        <h1 className="mt-4 text-3xl tracking-tight sm:text-4xl">Archive</h1>
      </div>

      {days.length === 0 ? (
        <p className="border-t border-black/15 pt-8 text-sm text-ink-soft">
          No past days yet — check back tomorrow.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 border-t border-black/15">
          {[...days].reverse().map(({ day, date, works }) => (
            <li key={day}>
              {/* Chrome restores a <details>'s open/closed state across a reload —
                  server always renders closed, so that alone can legitimately
                  differ from the client on first paint. Harmless; don't warn on it. */}
              <details className="group" suppressHydrationWarning>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-black/5 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm">
                    No. {day}
                    <span className="text-ink-soft"> — {formatDisplayDate(date)}</span>
                  </span>
                  <span
                    className="text-ink-soft transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </summary>
                <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
                  <div className="overflow-hidden">
                    <ul className="space-y-1 px-4 pb-4">
                      {works.map((work) => {
                        const accent = CATEGORY_ACCENT[work.category];
                        return (
                          <li key={work.category}>
                            <Link
                              href={`/archive/${day}/${work.category}`}
                              className="flex items-center gap-3 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
                            >
                              <span
                                className={`w-12 shrink-0 px-1.5 py-0.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${accent.bg} ${accent.text}`}
                              >
                                {CATEGORY_LABEL[work.category]}
                              </span>
                              <span className="font-serif text-ink">{work.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
