import { z } from "zod";

// Bumped after the epoch reset (Day 1 = launch day): the cache-hit check in
// useLocalState only compares calendar date, not day number, so a reader
// who'd loaded the site before the reset would otherwise keep seeing their
// stale pre-reset day number forever on unchanged dates. A key bump forces
// everyone's cache to miss once, cleanly, without needing per-record
// versioning for what should never happen again after launch.
export const STORAGE_KEY = "1000days:state:v2";

const WorkCategorySchema = z.enum(["poem", "essay", "story"]);

const WorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  author_note: z.string().nullable(),
  year: z.number().nullable(),
  category: WorkCategorySchema,
  text_content: z.string().nullable(),
  description: z.string(),
  source_name: z.string(),
  source_url: z.string(),
  public_domain: z.boolean(),
  difficulty: z.enum(["easy", "medium", "challenging"]),
  reading_minutes: z.number(),
  era: z.enum(["ancient", "19th_century", "early_20th_century", "modern"]).nullable(),
  region: z.string().nullable(),
  tags: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string(),
});

const DailySelectionSchema = z.object({
  day: z.number(),
  date: z.string(),
  poem: WorkSchema,
  essay: WorkSchema,
  story: WorkSchema,
});

export const LocalStateSchema = z.object({
  today: DailySelectionSchema.nullable(),
  // Per-reader "shuffle" overrides — kept as a separate top-level key, never
  // nested inside `today`, so Archive/Share (which only ever read `today`)
  // can't accidentally pick up a shuffled pick. Cleared on date rollover
  // alongside `today`, same as initialize() already does.
  randomized: z
    .object({ poem: WorkSchema.optional(), essay: WorkSchema.optional(), story: WorkSchema.optional() })
    .optional(),
});

export type LocalState = z.infer<typeof LocalStateSchema>;

export function parseLocalState(raw: string | null): LocalState | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const result = LocalStateSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
