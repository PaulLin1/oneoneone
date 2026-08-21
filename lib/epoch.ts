import { daysBetween } from "./dateMath";

/** Day 1 of the shared daily rotation — same for every reader, everywhere. */
export const EPOCH_START_DATE = "2026-08-18";

export function globalDayNumber(dateIso: string): number {
  return daysBetween(EPOCH_START_DATE, dateIso) + 1;
}

/** Inverse of globalDayNumber: the calendar date a given day number fell on. */
export function dateForDay(day: number): string {
  const epoch = Date.parse(`${EPOCH_START_DATE}T00:00:00Z`);
  const date = new Date(epoch + (day - 1) * 86_400_000);
  return date.toISOString().slice(0, 10);
}
