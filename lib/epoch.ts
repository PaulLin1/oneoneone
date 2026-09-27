import { daysBetween } from "./dateMath";

/** Day 1 of the shared daily sequence — same for every reader, everywhere. */
const EPOCH_START_DATE = "2026-09-11";

export function globalDayNumber(dateIso: string): number {
  return daysBetween(EPOCH_START_DATE, dateIso) + 1;
}
