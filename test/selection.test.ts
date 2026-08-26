import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDailyWorks, catalogUsage } from "@/lib/selection/algorithm";
import { dateForDay } from "@/lib/epoch";
import { makeWork, makeWorks } from "./helpers";

function catalog() {
  return [...makeWorks("poem", 5), ...makeWorks("essay", 4), ...makeWorks("story", 6)];
}

test("selectDailyWorks is deterministic for the same (date, works)", () => {
  const works = catalog();
  const date = dateForDay(10);
  const a = selectDailyWorks({ date, works });
  const b = selectDailyWorks({ date, works });
  assert.equal(a.poem.id, b.poem.id);
  assert.equal(a.essay.id, b.essay.id);
  assert.equal(a.story.id, b.story.id);
});

test("each pick actually belongs to its own category", () => {
  const works = catalog();
  const selection = selectDailyWorks({ date: dateForDay(3), works });
  assert.equal(selection.poem.category, "poem");
  assert.equal(selection.essay.category, "essay");
  assert.equal(selection.story.category, "story");
});

test("inactive works are never picked", () => {
  const works = [
    ...makeWorks("poem", 3, { is_active: false }),
    makeWork({ category: "poem", is_active: true, id: "the-only-active-poem" }),
    ...makeWorks("essay", 1),
    ...makeWorks("story", 1),
  ];
  for (let day = 1; day <= 20; day++) {
    const selection = selectDailyWorks({ date: dateForDay(day), works });
    assert.equal(selection.poem.id, "the-only-active-poem");
  }
});

test("throws a clear error when a category has no active works", () => {
  const works = makeWorks("poem", 3); // no essay, no story
  assert.throws(() => selectDailyWorks({ date: dateForDay(1), works }), /essay/);
});

test("cycles through all works in a category before repeating (no-repeat property)", () => {
  const works = [...makeWorks("poem", 5), ...makeWorks("essay", 1), ...makeWorks("story", 1)];
  const seen = new Set<string>();
  for (let day = 1; day <= 5; day++) {
    const selection = selectDailyWorks({ date: dateForDay(day), works });
    seen.add(selection.poem.id);
  }
  assert.equal(seen.size, 5, "5 consecutive days should show all 5 distinct works");

  const day1 = selectDailyWorks({ date: dateForDay(1), works }).poem.id;
  const day6 = selectDailyWorks({ date: dateForDay(6), works }).poem.id;
  assert.equal(day6, day1, "the cycle should repeat after exactly one full lap");
});

test("categories are picked independently — changing one category's pool doesn't change another's pick", () => {
  const poems = makeWorks("poem", 3);
  const essays = makeWorks("essay", 3);
  const stories = makeWorks("story", 3);
  const date = dateForDay(7);

  const before = selectDailyWorks({ date, works: [...poems, ...essays, ...stories] });
  const moreEssays = [...essays, ...makeWorks("essay", 5)];
  const after = selectDailyWorks({ date, works: [...poems, ...moreEssays, ...stories] });

  assert.equal(after.poem.id, before.poem.id);
  assert.equal(after.story.id, before.story.id);
});

test("dates before the epoch (negative day numbers) don't crash — modulo wraps correctly", () => {
  const works = catalog();
  const beforeEpoch = dateForDay(-30);
  assert.doesNotThrow(() => selectDailyWorks({ date: beforeEpoch, works }));
  const selection = selectDailyWorks({ date: beforeEpoch, works });
  assert.ok(works.some((w) => w.id === selection.poem.id));
});

test("day and date on the returned selection match the inputs", () => {
  const works = catalog();
  const date = dateForDay(42);
  const selection = selectDailyWorks({ date, works });
  assert.equal(selection.day, 42);
  assert.equal(selection.date, date);
});

test("catalogUsage: on day 1, exactly one work per category is used", () => {
  const works = [...makeWorks("poem", 5), ...makeWorks("essay", 4), ...makeWorks("story", 6)];
  const usage = catalogUsage(works, dateForDay(1));
  for (const category of ["poem", "essay", "story"] as const) {
    const used = usage[category].filter((u) => u.used);
    assert.equal(used.length, 1);
  }
});

test("catalogUsage: everything is used once the rotation has fully cycled", () => {
  const works = makeWorks("poem", 5);
  const usage = catalogUsage([...works, ...makeWorks("essay", 1), ...makeWorks("story", 1)], dateForDay(5));
  assert.ok(usage.poem.every((u) => u.used));
});

test("catalogUsage: a work not yet reached in the rotation is marked unused", () => {
  const works = makeWorks("poem", 5);
  const usage = catalogUsage([...works, ...makeWorks("essay", 1), ...makeWorks("story", 1)], dateForDay(1));
  const unused = usage.poem.filter((u) => !u.used);
  assert.equal(unused.length, 4);
});

test("catalogUsage agrees with selectDailyWorks: the used positions on day D are exactly what was ever picked in days 1..D", () => {
  const works = [...makeWorks("poem", 7), ...makeWorks("essay", 1), ...makeWorks("story", 1)];
  const day = 4;
  const pickedIds = new Set<string>();
  for (let d = 1; d <= day; d++) {
    pickedIds.add(selectDailyWorks({ date: dateForDay(d), works }).poem.id);
  }
  const usage = catalogUsage(works, dateForDay(day));
  const usedIds = new Set(usage.poem.filter((u) => u.used).map((u) => u.work.id));
  assert.deepEqual(usedIds, pickedIds);
});
