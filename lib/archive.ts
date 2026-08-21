import { selectDailyWorks } from "./selection/algorithm";
import { dateForDay, globalDayNumber } from "./epoch";
import { todayIso } from "./dateMath";
import type { Work, WorkCategory } from "./types";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

export type ArchiveDay = {
  day: number;
  date: string;
  works: { category: WorkCategory; title: string }[];
};

/** Every day before today — today is the live page, not archived yet. */
export function buildArchiveDays(works: Work[]): ArchiveDay[] {
  const currentDay = globalDayNumber(todayIso());
  const days: ArchiveDay[] = [];
  for (let day = 1; day < currentDay; day++) {
    const date = dateForDay(day);
    const selection = selectDailyWorks({ date, works });
    days.push({
      day,
      date,
      works: CATEGORIES.map((category) => ({ category, title: selection[category].title })),
    });
  }
  return days;
}
