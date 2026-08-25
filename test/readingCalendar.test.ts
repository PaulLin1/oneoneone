import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReadingCalendar, type ReadingHistoryEntry } from "@/lib/readingCalendar";

test("every week column has exactly 7 days", () => {
  const { weeks } = buildReadingCalendar("2026-08-23", 6, []);
  for (const column of weeks) {
    assert.equal(column.length, 7);
  }
});

test("every week starts on a Sunday", () => {
  const { weeks } = buildReadingCalendar("2026-08-23", 6, []);
  for (const column of weeks) {
    const weekday = new Date(`${column[0].date}T00:00:00Z`).getUTCDay();
    assert.equal(weekday, 0);
  }
});

test("today appears in the grid, and nothing after it is marked future", () => {
  const today = "2026-08-23";
  const { weeks } = buildReadingCalendar(today, 4, []);
  const allDays = weeks.flat();
  const todayCell = allDays.find((d) => d.date === today);
  assert.ok(todayCell, "today should be present in the grid");
  assert.equal(todayCell?.future, false);

  for (const day of allDays) {
    assert.equal(day.future, day.date > today);
  }
});

test("no day before today is ever marked future", () => {
  const today = "2026-08-23";
  const { weeks } = buildReadingCalendar(today, 4, []);
  for (const day of weeks.flat()) {
    if (day.date <= today) assert.equal(day.future, false);
  }
});

test("entries are bucketed onto the matching date and category", () => {
  const rows: ReadingHistoryEntry[] = [
    {
      id: "1",
      date: "2026-08-20",
      category: "poem",
      title: "Ode",
      author: "Keats",
      workId: "w1",
      source: "daily",
      sourceDate: null,
    },
    {
      id: "2",
      date: "2026-08-20",
      category: "essay",
      title: "On X",
      author: null,
      workId: null,
      source: "external",
      sourceDate: null,
    },
  ];
  const { weeks } = buildReadingCalendar("2026-08-23", 4, rows);
  const day = weeks.flat().find((d) => d.date === "2026-08-20");
  assert.equal(day?.entries.poem[0].title, "Ode");
  assert.equal(day?.entries.essay[0].title, "On X");
  assert.equal(day?.entries.essay[0].workId, null);
  assert.deepEqual(day?.entries.story, []);
});

test("multiple reads in the same category on the same day both survive — the daily pick and a shuffle, say", () => {
  const rows: ReadingHistoryEntry[] = [
    {
      id: "1",
      date: "2026-08-20",
      category: "poem",
      title: "Daily Pick",
      author: "A",
      workId: "w1",
      source: "daily",
      sourceDate: null,
    },
    {
      id: "2",
      date: "2026-08-20",
      category: "poem",
      title: "Shuffled Pick",
      author: "B",
      workId: "w2",
      source: "random",
      sourceDate: null,
    },
  ];
  const { weeks } = buildReadingCalendar("2026-08-23", 4, rows);
  const day = weeks.flat().find((d) => d.date === "2026-08-20");
  assert.equal(day?.entries.poem.length, 2);
  assert.deepEqual(
    day?.entries.poem.map((e) => e.title).sort(),
    ["Daily Pick", "Shuffled Pick"]
  );
});

test("month labels mark the first column of each new month, in column order", () => {
  const { monthLabels } = buildReadingCalendar("2026-08-23", 10, []);
  assert.ok(monthLabels.length >= 1);
  for (let i = 1; i < monthLabels.length; i++) {
    assert.ok(monthLabels[i].column > monthLabels[i - 1].column);
  }
  // The last label always covers the column today falls in.
  const last = monthLabels[monthLabels.length - 1];
  assert.equal(last.label, new Date("2026-08-23T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }));
});

test("requesting more weeks only grows the grid backward — today's column position is stable", () => {
  const small = buildReadingCalendar("2026-08-23", 4, []);
  const big = buildReadingCalendar("2026-08-23", 8, []);
  const lastSmall = small.weeks[small.weeks.length - 1];
  const lastBig = big.weeks[big.weeks.length - 1];
  assert.deepEqual(lastSmall, lastBig);
});
