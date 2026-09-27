import { daysBetween, todayIso } from "./dateMath";

/** Day 1 of the shared daily sequence — same for every reader, everywhere. */
export const EPOCH_START_DATE = "2026-09-07";

export function globalDayNumber(dateIso: string): number {
  return daysBetween(EPOCH_START_DATE, dateIso) + 1;
}

/** The date of edition No. `day` — the inverse of globalDayNumber. */
export function dateForDay(day: number): string {
  const date = new Date(`${EPOCH_START_DATE}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return todayIso(date);
}
