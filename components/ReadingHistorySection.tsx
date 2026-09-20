"use client";

import { useMemo, type ReactNode } from "react";
import { currentStreak, type ReadingHistoryEntry } from "@/lib/readingCalendar";
import { ReadingCalendar } from "@/components/ReadingCalendar";

/**
 * Owns the `rows` state for /account — split into two sections (per the
 * layout, not the data): "Reading history" is the calendar + the selected
 * day's detail panel; "Overview" is everything derived from that same
 * data (the streak/count stats), kept visually separate so the calendar
 * isn't sharing a section with unrelated content.
 * Both derive from the same `rows` so Overview's stats always match what
 * the calendar below it shows.
 */
export function ReadingHistorySection({
  today,
  weeks,
  initialHistory,
  adminContent,
  recommendedContent,
}: {
  today: string;
  weeks: number;
  initialHistory: ReadingHistoryEntry[];
  /** Reviewer/admin-only cards (see AdminOverviewSection) rendered above
   *  Overview/Reading history, in the same scroll container — a plain
   *  slot rather than this component knowing anything about candidates
   *  or the catalog. */
  adminContent?: ReactNode;
  /** RecommendedWorks, rendered below Reading history — same plain-slot reasoning as adminContent. */
  recommendedContent?: ReactNode;
}) {
  const rows = initialHistory;

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
    // No card borders — sections read as structure through the label +
    // rule-dot header and generous spacing alone, matching the rest of the
    // (borderless) design system.
    <div className="flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto">
      {adminContent}
      <section className="shrink-0">
        <div className="flex items-center gap-2 pb-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Overview</h2>
        </div>
        <div className="flex gap-6 sm:gap-8">
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
      </section>

      <section className="shrink-0">
        <div className="flex items-center gap-2 pb-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Reading history
          </h2>
        </div>
        <ReadingCalendar today={today} weeks={weeks} rows={rows} />
      </section>

      {recommendedContent}
    </div>
  );
}
