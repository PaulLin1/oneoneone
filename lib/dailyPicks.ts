import { getDb } from "@/lib/db";
import { globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import type { DailySelection, Work, WorkCategory } from "@/lib/types";

/**
 * The daily-content core. There is no rotation and no fixed catalogue — the
 * automated pipeline pins three freshly-discovered works to each calendar
 * date in the `daily_picks` table (db/migrations/0010), and everything the
 * reader sees is just a read of that table:
 *   - the home page / /api/daily-selection → today's row set
 *   - the Archive → every past date's row set
 * A date with fewer than three active picks (pipeline hasn't run yet, or a
 * work was archived after the fact) reads as "not published" — null here,
 * skipped in the Archive.
 */

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

export type ArchiveDay = {
  day: number;
  date: string;
  works: { category: WorkCategory; title: string }[];
};

/** One (date, category) → work row, joined to the work's title. */
export type DailyPickRow = { date: string; category: WorkCategory; title: string };

function groupByDate(rows: DailyPickRow[]): Map<string, DailyPickRow[]> {
  const byDate = new Map<string, DailyPickRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }
  return byDate;
}

function isComplete(rows: DailyPickRow[]): boolean {
  const present = new Set(rows.map((r) => r.category));
  return CATEGORIES.every((c) => present.has(c));
}

/**
 * The three official works pinned to `date`, or null if that day isn't
 * fully published (pipeline hasn't run, or a pick was archived since).
 */
export async function getDailySelection(date: string): Promise<DailySelection | null> {
  const sql = getDb();
  const rows = (await sql`
    select f.*
    from daily_picks dp
    join works_feed f on f.id = dp.work_id
    where dp.pick_date = ${date} and f.is_active = true
  `) as unknown as Work[];

  const byCategory = new Map(rows.map((w) => [w.category, w]));
  if (CATEGORIES.some((c) => !byCategory.has(c))) return null;

  return {
    day: globalDayNumber(date),
    date,
    poem: byCategory.get("poem")!,
    essay: byCategory.get("essay")!,
    story: byCategory.get("story")!,
  };
}

/** Every pinned pick, oldest first — for the Archive and the sitemap. */
export async function getPublishedPicks(): Promise<DailyPickRow[]> {
  const sql = getDb();
  return (await sql`
    select to_char(dp.pick_date, 'YYYY-MM-DD') as date, f.category, f.title
    from daily_picks dp
    join works_feed f on f.id = dp.work_id
    where f.is_active = true
    order by dp.pick_date asc
  `) as unknown as DailyPickRow[];
}

/**
 * Pure: given every pinned pick and "today", the list of complete days
 * strictly before today, ascending by day number. A day with a missing
 * category (or dated today / in the future / before the epoch) is skipped
 * — the Archive only shows fully-published back issues.
 */
export function buildArchiveDays(picks: DailyPickRow[], today: string = todayIso()): ArchiveDay[] {
  const currentDay = globalDayNumber(today);
  const days: ArchiveDay[] = [];

  for (const [date, rows] of groupByDate(picks)) {
    const day = globalDayNumber(date);
    if (day < 1 || day >= currentDay) continue;
    if (!isComplete(rows)) continue;
    days.push({
      day,
      date,
      works: CATEGORIES.map((category) => ({
        category,
        title: rows.find((r) => r.category === category)!.title,
      })),
    });
  }

  return days.sort((a, b) => a.day - b.day);
}

export type PicksLogDay = {
  date: string;
  day: number;
  complete: boolean;
  works: { category: WorkCategory; title: string }[];
};

/**
 * Newest-first, most-recent `limit` days including today and any incomplete
 * days — the admin-facing "what the pipeline has published" view on /account.
 */
export async function getDailyPicksLog(limit = 14): Promise<PicksLogDay[]> {
  const picks = await getPublishedPicks();
  const byDate = groupByDate(picks);

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, limit)
    .map(([date, rows]) => ({
      date,
      day: globalDayNumber(date),
      complete: isComplete(rows),
      works: CATEGORIES.filter((c) => rows.some((r) => r.category === c)).map((category) => ({
        category,
        title: rows.find((r) => r.category === category)!.title,
      })),
    }));
}

/** Pin (or re-pin) one category's official work for a date. */
export async function recordDailyPick(
  date: string,
  category: WorkCategory,
  workId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into daily_picks (pick_date, category, work_id)
    values (${date}, ${category}, ${workId})
    on conflict (pick_date, category)
    do update set work_id = excluded.work_id, created_at = now()
  `;
}
