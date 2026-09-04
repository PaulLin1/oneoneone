"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  adminContent,
}: {
  today: string;
  weeks: number;
  initialHistory: ReadingHistoryEntry[];
  /** Reviewer/admin-only cards (see AdminOverviewSection) rendered above
   *  Overview/Reading history, in the same scroll container — a plain
   *  slot rather than this component knowing anything about candidates
   *  or the catalog. */
  adminContent?: ReactNode;
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
    // sits above Reading history instead of pinned to the bottom.
    // Both are real bordered cards (header bar + body) rather than a bare
    // heading floating over content — that's what gives the page an
    // actual visual structure instead of everything reading as one loose
    // stack of elements.
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      {adminContent}
      <section className="shrink-0 border border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 px-5 py-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Overview</h2>
        </div>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6 sm:gap-8">
            <div>
              <p className="font-serif text-3xl leading-none">{stats.totalReads}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Reads logged</p>
            </div>
            <div className="border-l border-ink/15 pl-6 sm:pl-8">
              <p className="font-serif text-3xl leading-none">{stats.daysActive}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Days active</p>
            </div>
            <div className="border-l border-ink/15 pl-6 sm:pl-8">
              <p className="font-serif text-3xl leading-none">{stats.streak}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">Day streak</p>
            </div>
          </div>
          <Link
            href="/recommend"
            className="shrink-0 rounded-full border border-ink px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Recommend a work
          </Link>
        </div>
      </section>

      <section className="shrink-0 border border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 px-5 py-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Reading history
          </h2>
        </div>
        <div className="p-5">
          <ReadingCalendar today={today} weeks={weeks} rows={rows} onRowsChange={setRows} />
        </div>
      </section>
    </div>
  );
}
