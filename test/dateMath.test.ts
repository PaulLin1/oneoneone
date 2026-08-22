import { test } from "node:test";
import assert from "node:assert/strict";
import { todayIso, daysBetween, formatDisplayDate } from "@/lib/dateMath";

test("todayIso formats a Date as UTC YYYY-MM-DD", () => {
  assert.equal(todayIso(new Date("2026-08-22T23:59:59Z")), "2026-08-22");
  assert.equal(todayIso(new Date("2026-01-01T00:00:00Z")), "2026-01-01");
});

test("daysBetween is 0 for the same date", () => {
  assert.equal(daysBetween("2026-08-22", "2026-08-22"), 0);
});

test("daysBetween counts forward and backward symmetrically", () => {
  assert.equal(daysBetween("2026-08-22", "2026-08-23"), 1);
  assert.equal(daysBetween("2026-08-23", "2026-08-22"), -1);
});

test("daysBetween crosses month and year boundaries correctly", () => {
  assert.equal(daysBetween("2026-01-31", "2026-02-01"), 1);
  assert.equal(daysBetween("2025-12-31", "2026-01-01"), 1);
});

test("daysBetween handles a leap-year February correctly", () => {
  // 2028 is a leap year: Feb has 29 days.
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
  // 2026 is not: Feb has 28 days.
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
});

test("formatDisplayDate renders a human-readable UTC date", () => {
  assert.equal(formatDisplayDate("2026-08-22"), "Aug 22, 2026");
  assert.equal(formatDisplayDate("2026-01-01"), "Jan 1, 2026");
});
