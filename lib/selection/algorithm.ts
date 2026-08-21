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
