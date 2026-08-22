import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchiveDays } from "@/lib/archive";
import { globalDayNumber, dateForDay } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import { makeWorks } from "./helpers";

// buildArchiveDays reads the real current date internally (no injectable
// "today"), so these tests check it against the epoch functions rather
// than a hardcoded day count — that keeps them passing on whatever day
// they're actually run, today or a year from now.

function catalog() {
  return [...makeWorks("poem", 4), ...makeWorks("essay", 4), ...makeWorks("story", 4)];
}

test("returns exactly (today's day number - 1) entries — every day before today, not including it", () => {
  const currentDay = globalDayNumber(todayIso());
  const days = buildArchiveDays(catalog());
  assert.equal(days.length, Math.max(0, currentDay - 1));
});

test("each entry's date matches its day number via dateForDay", () => {
  const days = buildArchiveDays(catalog());
  for (const entry of days) {
    assert.equal(entry.date, dateForDay(entry.day));
  }
});

test("each entry has exactly one poem, one essay, one story", () => {
  const days = buildArchiveDays(catalog());
  for (const entry of days.slice(0, 5)) {
    const categories = entry.works.map((w) => w.category).sort();
    assert.deepEqual(categories, ["essay", "poem", "story"]);
  }
});

test("days are in ascending order starting from Day 1", () => {
  const days = buildArchiveDays(catalog());
  if (days.length > 0) {
    assert.equal(days[0].day, 1);
  }
  for (let i = 1; i < days.length; i++) {
    assert.equal(days[i].day, days[i - 1].day + 1);
  }
});
