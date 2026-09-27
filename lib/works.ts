import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Work, WorkCategory } from "@/lib/types";

/**
 * The published works, one file per category per day:
 *
 *   data/works/<category>/<YYYY-MM-DD>.json
 *
 * written by scripts/find-work.ts (scheduled ahead by scripts/stock.ts) and
 * read by the site. One small file per day keeps each page read cheap however
 * large the archive grows.
 */
export type ScheduledWork = Work & { date: string };

export const WORKS_DIR = path.join(process.cwd(), "data", "works");
export const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

export const workPath = (category: WorkCategory, date: string) => path.join(WORKS_DIR, category, `${date}.json`);

/** Every date that has a work for this category, oldest first. */
export function scheduledDates(category: WorkCategory): string[] {
  const dir = path.join(WORKS_DIR, category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => name.match(DATE_FILE)?.[1])
    .filter((date): date is string => Boolean(date))
    .sort();
}

/** The work saved for exactly this date, or null if there's none or the file is unreadable. */
export function readWork(category: WorkCategory, date: string): ScheduledWork | null {
  try {
    const work = JSON.parse(readFileSync(workPath(category, date), "utf8")) as ScheduledWork;
    return work.title && work.author && work.text_content ? { ...work, date } : null;
  } catch {
    return null;
  }
}

/**
 * The work to show on this date: the one scheduled for it, or — if that day
 * is missing or its file is broken — the latest readable one before it.
 * Works scheduled for later dates are never returned.
 */
export function workOn(category: WorkCategory, date: string): ScheduledWork | null {
  const exact = readWork(category, date);
  if (exact) return exact;
  const earlier = scheduledDates(category).filter((d) => d < date);
  for (let i = earlier.length - 1; i >= 0; i--) {
    const work = readWork(category, earlier[i]);
    if (work) return work;
  }
  return null;
}

/** Every saved work in every category. */
export function loadAllWorks(): ScheduledWork[] {
  return CATEGORIES.flatMap((category) =>
    scheduledDates(category)
      .map((date) => readWork(category, date))
      .filter((work): work is ScheduledWork => work !== null)
  );
}
