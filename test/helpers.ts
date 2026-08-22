import type { Work, WorkCategory } from "@/lib/types";

let counter = 0;

/** Minimal fake Work for tests that only care about id/category/is_active. */
export function makeWork(overrides: Partial<Work> = {}): Work {
  counter++;
  return {
    id: overrides.id ?? `work-${counter.toString().padStart(4, "0")}`,
    title: `Test Work ${counter}`,
    author: "Test Author",
    author_note: null,
    year: 1900,
    category: "poem",
    text_content: "Some text.",
    description: "A test work.",
    source_name: "Test Source",
    source_url: "https://example.com",
    public_domain: true,
    difficulty: "medium",
    reading_minutes: 1,
    era: "early_20th_century",
    region: null,
    tags: [],
    is_active: true,
    created_at: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeWorks(category: WorkCategory, count: number, overrides: Partial<Work> = {}): Work[] {
  return Array.from({ length: count }, (_, i) => makeWork({ id: `${category}-${i}`, category, ...overrides }));
}
