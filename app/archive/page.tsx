import Link from "next/link";
import { getDb } from "@/lib/db";
import { buildArchiveDays } from "@/lib/archive";
import { formatDisplayDate } from "@/lib/dateMath";
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

  return (
    <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <h1 className="text-3xl tracking-tight sm:text-4xl">Archive</h1>
        <div className="mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
      </div>

      {days.length === 0 ? (
        <p className="border-t border-ink/15 pt-8 text-sm text-ink-soft">
          No past days yet — check back tomorrow.
        </p>
      ) : (
        // A grid of back-issue cards, not a one-per-row accordion — every
        // day's three works are visible at once (no click needed), and the
        // column count grows with the viewport instead of leaving a narrow
        // list stranded in a sea of white on a wide screen.
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...days].reverse().map(({ day, date, works }) => (
            <li key={day} className="border border-ink/15 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">No. {day}</span>
                <span className="text-xs text-ink-soft">{formatDisplayDate(date)}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {works.map((work) => {
                  const accent = CATEGORY_ACCENT[work.category];
                  return (
                    <li key={work.category}>
                      <Link
                        href={`/archive/${day}/${work.category}`}
                        className="-mx-2 flex items-center gap-2.5 px-2 py-1 text-sm text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                      >
                        <span
                          className={`w-12 shrink-0 px-1.5 py-0.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${accent.bg} ${accent.text}`}
                        >
                          {CATEGORY_LABEL[work.category]}
                        </span>
                        <span className="truncate font-serif text-ink">{work.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
