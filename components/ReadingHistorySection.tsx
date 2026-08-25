"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { currentStreak, type ReadingHistoryEntry } from "@/lib/readingCalendar";
import { ReadingCalendar } from "@/components/ReadingCalendar";

/**
 * Owns the `rows` state for /account — split into two sections (per the
 * layout, not the data): "Reading history" is the calendar + the selected
 * day's detail panel; "Overview" is everything derived from that same
 * data (the streak/count stats) plus the Recommend link, kept visually
 * separate so the calendar isn't sharing a section with unrelated content.
 * Both read live `rows`, so an add/clear in the calendar updates the
 * Overview stats immediately — that's the whole reason this state lives
 * here instead of inside ReadingCalendar itself.
 */
export function ReadingHistorySection({
  today,
  weeks,
  initialHistory,
}: {
  today: string;
  weeks: number;
  initialHistory: ReadingHistoryEntry[];
}) {
  const [rows, setRows] = useState(initialHistory);

  const stats = useMemo(
    () => ({
      totalReads: rows.length,
      daysActive: new Set(rows.map((r) => r.date)).size,
      streak: currentStreak(today, rows),
    }),
    [rows, today]
  );

  return (
    // Neither section is stretched to fill the page — the calendar is
    // naturally compact and forcing it to fill leftover height (so the
    // detail panel beside it could grow to match) just left a gap under
    // the calendar itself, since it has no more content to fill it with.
    // Each section takes only the height its own content needs; Overview
    // sits right below Reading history instead of pinned to the bottom.
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <div className="flex shrink-0 flex-col gap-3">
        <h2 className="shrink-0 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
          Reading history
        </h2>
        <ReadingCalendar today={today} weeks={weeks} rows={rows} onRowsChange={setRows} />
      </div>

      <div className="shrink-0 border-t border-black/15 pt-5">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Overview</h2>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="flex gap-8">
            <div>
              <p className="font-serif text-3xl leading-none">{stats.totalReads}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Reads logged</p>
            </div>
            <div>
              <p className="font-serif text-3xl leading-none">{stats.daysActive}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Days active</p>
            </div>
            <div>
              <p className="font-serif text-3xl leading-none">{stats.streak}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Day streak</p>
            </div>
          </div>
          <Link
            href="/recommend"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
          >
            Recommend a work →
          </Link>
        </div>
      </div>
    </div>
  );
}
