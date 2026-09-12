import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchiveDays, type DailyPickRow } from "@/lib/dailyPicks";
import { dateForDay } from "@/lib/epoch";
import type { WorkCategory } from "@/lib/types";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

/** A full (poem, essay, story) set of picks for the given day number. */
function fullDay(day: number): DailyPickRow[] {
  const date = dateForDay(day);
  return CATEGORIES.map((category) => ({ date, category, title: `${category} #${day}` }));
}

// "today" is day 5 in every test below unless noted.
const TODAY = dateForDay(5);

test("returns every complete day strictly before today, ascending by day number", () => {
  const picks = [...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4)];
  const days = buildArchiveDays(picks, TODAY);
  assert.deepEqual(
    days.map((d) => d.day),
    [1, 2, 3, 4]
  );
});

test("today and future days are excluded", () => {
  const picks = [...fullDay(4), ...fullDay(5), ...fullDay(6)];
  const days = buildArchiveDays(picks, TODAY);
  assert.deepEqual(
    days.map((d) => d.day),
    [4]
  );
});

test("days before the epoch (day <= 0) are excluded", () => {
  const picks = [...fullDay(0), ...fullDay(-1), ...fullDay(2)];
  const days = buildArchiveDays(picks, TODAY);
  assert.deepEqual(
    days.map((d) => d.day),
    [2]
  );
});

test("a day missing one category is skipped entirely", () => {
  const incomplete = fullDay(2).filter((p) => p.category !== "essay");
  const picks = [...fullDay(1), ...incomplete, ...fullDay(3)];
  const days = buildArchiveDays(picks, TODAY);
  assert.deepEqual(
    days.map((d) => d.day),
    [1, 3]
  );
});

test("each day carries exactly one poem, one essay, one story in that order", () => {
  const days = buildArchiveDays([...fullDay(1), ...fullDay(2)], TODAY);
  for (const day of days) {
    assert.deepEqual(
      day.works.map((w) => w.category),
      ["poem", "essay", "story"]
    );
  }
});

test("each day's date matches its day number via dateForDay", () => {
  const days = buildArchiveDays([...fullDay(1), ...fullDay(2), ...fullDay(3)], TODAY);
  for (const day of days) {
    assert.equal(day.date, dateForDay(day.day));
  }
});

test("no published picks yet → empty archive", () => {
  assert.deepEqual(buildArchiveDays([], TODAY), []);
});
