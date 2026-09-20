import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOverlap } from "@/lib/recommendations";
import type { Work } from "@/lib/types";

function work(overrides: Partial<Work>): Work {
  return {
    id: "id",
    title: "Title",
    author: "Author",
    author_note: null,
    author_portrait_url: null,
    year: 1900,
    category: "poem",
    text_content: "text",
    description: "description",
    source_name: "source",
    source_url: "https://example.com",
    public_domain: true,
    difficulty: "medium",
    reading_minutes: 5,
    era: "19th_century",
    region: null,
    tags: [],
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("scoreOverlap: no shared tags, different author, different era -> 0", () => {
  const a = work({ tags: ["nature"], author: "A", era: "19th_century" });
  const b = work({ tags: ["war"], author: "B", era: "modern" });
  assert.equal(scoreOverlap(a, b), 0);
});

test("scoreOverlap: each shared tag counts double", () => {
  const a = work({ tags: ["nature", "loss"], author: "A", era: "19th_century" });
  const b = work({ tags: ["nature", "loss"], author: "B", era: "modern" });
  assert.equal(scoreOverlap(a, b), 4);
});

test("scoreOverlap: same author adds 3, regardless of tags", () => {
  const a = work({ tags: [], author: "Same", era: "19th_century" });
  const b = work({ tags: [], author: "Same", era: "modern" });
  assert.equal(scoreOverlap(a, b), 3);
});

test("scoreOverlap: same era adds 1", () => {
  const a = work({ tags: [], author: "A", era: "19th_century" });
  const b = work({ tags: [], author: "B", era: "19th_century" });
  assert.equal(scoreOverlap(a, b), 1);
});

test("scoreOverlap: two works with a null era never earn the era bonus", () => {
  const a = work({ tags: [], author: "A", era: null });
  const b = work({ tags: [], author: "B", era: null });
  assert.equal(scoreOverlap(a, b), 0);
});

test("scoreOverlap: tags, author, and era bonuses all add together", () => {
  const a = work({ tags: ["nature"], author: "Same", era: "modern" });
  const b = work({ tags: ["nature"], author: "Same", era: "modern" });
  assert.equal(scoreOverlap(a, b), 2 + 3 + 1);
});

test("scoreOverlap: is symmetric", () => {
  const a = work({ tags: ["nature", "loss"], author: "A", era: "modern" });
  const b = work({ tags: ["loss", "grief"], author: "B", era: "19th_century" });
  assert.equal(scoreOverlap(a, b), scoreOverlap(b, a));
});
