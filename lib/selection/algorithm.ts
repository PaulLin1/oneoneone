import type { DailySelection, Work, WorkCategory } from "@/lib/types";
import { globalDayNumber } from "@/lib/epoch";
import { hashStringToInt, mulberry32 } from "./rng";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

function fisherYatesShuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * A fixed rotation order per category, seeded once (not per-day) so it never
 * changes unless the catalog itself changes. Every reader, everywhere, walks
 * this same sequence — day N's pick is just `order[N % order.length]`. This
 * is what makes "today's three" identical for everyone (Wordle's answer
 * list, essentially) and guarantees no repeat until the whole category has
 * cycled through, with no per-user state involved at all.
 */
function rotationOrder(categoryWorks: Work[], category: WorkCategory): Work[] {
  const sorted = [...categoryWorks].sort((a, b) => a.id.localeCompare(b.id));
  const rng = mulberry32(hashStringToInt(`oneoneone-rotation-v1:${category}`));
  return fisherYatesShuffle(sorted, rng);
}

/**
 * Pure, deterministic, and global: same (date, works) always produces the
 * same three for every reader — there is no per-user input at all. That's
 * the whole point (a shared daily puzzle, like Wordle), so this never takes
 * a user id, read history, or preference of any kind. Each category is
 * picked entirely independently of the others — by design, there's no
 * grouping or connection drawn between the day's three picks.
 */
export function selectDailyWorks(params: { date: string; works: Work[] }): DailySelection {
  const { date, works } = params;
  const day = globalDayNumber(date);
  const dayIndex = day - 1;

  const picks: Partial<Record<WorkCategory, Work>> = {};

  for (const category of CATEGORIES) {
    const categoryWorks = works.filter((w) => w.category === category && w.is_active);
    if (categoryWorks.length === 0) {
      throw new Error(`No active works available for category "${category}".`);
    }
    const order = rotationOrder(categoryWorks, category);
    const index = ((dayIndex % order.length) + order.length) % order.length;
    picks[category] = order[index];
  }

  const finalPicks = picks as Record<WorkCategory, Work>;
  return { ...finalPicks, day, date };
}

export type CatalogUsage = { work: Work; position: number; cycleLength: number; used: boolean };

/**
 * For each active work, its fixed position in that category's rotation and
 * whether it's already come up as a daily pick at least once by `today`.
 * Not part of the daily-selection contract — this is for the admin-facing
 * catalog view in /account, so a reviewer can see what's actually run yet
 * versus still waiting its turn in the rotation.
 *
 * A work at rotation position p has been shown by day D (1-indexed) iff
 * p < D: over days 1..D the indices shown are {0..D-1} mod L, and since p
 * is already in [0, L), that set contains p exactly when p < D — this
 * holds whether or not the rotation has wrapped past a full cycle.
 */
export function catalogUsage(works: Work[], today: string): Record<WorkCategory, CatalogUsage[]> {
  const currentDay = globalDayNumber(today);
  const result = {} as Record<WorkCategory, CatalogUsage[]>;

  for (const category of CATEGORIES) {
    const categoryWorks = works.filter((w) => w.category === category && w.is_active);
    const order = rotationOrder(categoryWorks, category);
    result[category] = order.map((work, position) => ({
      work,
      position,
      cycleLength: order.length,
      used: position < currentDay,
    }));
  }

  return result;
}
