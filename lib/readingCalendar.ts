import type { WorkCategory } from "./types";

/**
 * How a read happened — shown back on /account as a signifier instead of
 * every read looking like that day's canonical pick:
 *   'daily'    today's official pick, read unshuffled
 *   'random'   a shuffled pick, or a work opened via /work/[id]
 *   'archive'  an archived day's official pick, opened after that day —
 *              `sourceDate` carries which day it's actually from
 *   'external' something read outside the site entirely
 */
export type ReadingSource = "daily" | "random" | "archive" | "external";

export type ReadingHistoryEntry = {
  id: string;
  date: string; // YYYY-MM-DD — which calendar day this counts toward
  category: WorkCategory;
  title: string;
  author: string | null;
  workId: string | null; // null = read outside the site
  source: ReadingSource;
  /** Only set for source === 'archive': the day the pick is actually from. */
  sourceDate: string | null;
};

export type CalendarDay = {
  date: string;
  /** Past `today` — padding to complete the last week, never a real slot. */
  future: boolean;
  /** Zero or more reads per category — the same slot can hold the daily
   *  pick and a shuffle (or several) side by side, not just one. */
  entries: Record<WorkCategory, ReadingHistoryEntry[]>;
};

export type MonthLabel = { column: number; label: string };

export type ReadingCalendarGrid = {
  /** Each inner array is one Sun–Sat column of exactly 7 days. */
  weeks: CalendarDay[][];
  monthLabels: MonthLabel[];
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

function monthLabelOf(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * A GitHub-contributions-style grid: `weeks` full Sun–Sat columns ending on
 * the week containing `today`. Aligned outward to whole weeks, so the
 * actual span is always a little more than `weeks * 7` days — the same
 * trade GitHub's own calendar makes rather than starting mid-week. Days
 * after `today` (padding to finish that last week) are marked `future` so
 * the caller can render them as empty space, never a fillable slot.
 */
export function buildReadingCalendar(
  today: string,
  weeks: number,
  rows: ReadingHistoryEntry[]
): ReadingCalendarGrid {
  const byDate = new Map<string, Record<WorkCategory, ReadingHistoryEntry[]>>();
  for (const row of rows) {
    const forDay = byDate.get(row.date) ?? { poem: [], essay: [], story: [] };
    forDay[row.category].push(row);
    byDate.set(row.date, forDay);
  }

  const rangeStart = addDaysIso(today, -(weeks * 7 - 1));
  const gridStart = addDaysIso(rangeStart, -weekdayOf(rangeStart));
  const gridEnd = addDaysIso(today, 6 - weekdayOf(today));

  const days: CalendarDay[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDaysIso(cursor, 1)) {
    days.push({
      date: cursor,
      future: cursor > today,
      entries: byDate.get(cursor) ?? { poem: [], essay: [], story: [] },
    });
  }

  const weekColumns: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weekColumns.push(days.slice(i, i + 7));
  }

  // A label needs a minimum column gap from the previous one or the text
  // overlaps (a 3-letter month name is wider than one 14px column) — same
  // reason GitHub's own calendar sometimes skips a short month's label.
  const MIN_COLUMN_GAP = 3;
  const monthLabels: MonthLabel[] = [];
  let lastMonth = "";
  weekColumns.forEach((column, i) => {
    const label = monthLabelOf(column[0].date);
    const last = monthLabels[monthLabels.length - 1];
    if (label !== lastMonth && (!last || i - last.column >= MIN_COLUMN_GAP)) {
      monthLabels.push({ column: i, label });
      lastMonth = label;
    }
  });

  return { weeks: weekColumns, monthLabels };
}
