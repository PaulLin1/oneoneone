import { test } from "node:test";
import assert from "node:assert/strict";
import { EPOCH_START_DATE, globalDayNumber, dateForDay } from "@/lib/epoch";

test("EPOCH_START_DATE is Day 1", () => {
  assert.equal(globalDayNumber(EPOCH_START_DATE), 1);
});

test("dateForDay(1) is the epoch start date", () => {
  assert.equal(dateForDay(1), EPOCH_START_DATE);
});

test("day number increases by exactly 1 per calendar day", () => {
  const tomorrow = dateForDay(2);
  assert.equal(globalDayNumber(tomorrow), 2);
  assert.equal(daysAfterEpoch(tomorrow), 1);
});

function daysAfterEpoch(dateIso: string): number {
  return globalDayNumber(dateIso) - 1;
}

test("globalDayNumber and dateForDay are inverses across a wide range", () => {
  for (let day = 1; day <= 400; day++) {
    const date = dateForDay(day);
    assert.equal(globalDayNumber(date), day, `day ${day} -> date ${date} -> day should round-trip`);
  }
});

test("dates before the epoch produce day numbers <= 0, not clamped or thrown", () => {
  // The day before launch is Day 0, the day before that is Day -1, etc. —
  // selectDailyWorks relies on this staying arithmetic (see selection.test.ts's
  // negative-modulo case), not on this function guarding the range itself.
  const dayBefore = dateForDay(0);
  assert.equal(globalDayNumber(dayBefore), 0);
  const twoDaysBefore = dateForDay(-1);
  assert.equal(globalDayNumber(twoDaysBefore), -1);
});
