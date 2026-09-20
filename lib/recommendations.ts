import { getDb } from "@/lib/db";
import type { Work } from "@/lib/types";

/**
 * Pure similarity score between two works — content-based, no ML: shared
 * tags weigh most, with small bonuses for the same author or era. No
 * category bonus — a good recommendation can cross poem/essay/story freely.
 */
export function scoreOverlap(a: Work, b: Work): number {
  const sharedTags = a.tags.filter((tag) => b.tags.includes(tag)).length;
  const sameAuthor = a.author === b.author ? 1 : 0;
  const sameEra = a.era !== null && a.era === b.era ? 1 : 0;
  return sharedTags * 2 + sameAuthor * 3 + sameEra;
}

const byRecency = (a: Work, b: Work) => Date.parse(b.created_at) - Date.parse(a.created_at);

/**
 * Up to `limit` other active works most similar to `workId` — powers a
 * "you might also like" strip below a single work. Empty (not padded with
 * unrelated filler) when nothing scores above zero.
 */
export async function getSimilarWorks(workId: string, limit = 3): Promise<Work[]> {
  const sql = getDb();

  const workRows = (await sql`select * from works_feed where id = ${workId} limit 1`) as unknown as Work[];
  const work = workRows[0];
  if (!work) return [];

  const candidateRows = (await sql`
    select * from works_feed where is_active = true and id != ${workId}
  `) as unknown as Work[];

  return candidateRows
    .map((candidate) => ({ candidate, score: scoreOverlap(work, candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || byRecency(a.candidate, b.candidate))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/**
 * Up to `limit` active works `userId` hasn't read yet, ranked by the best
 * overlap with anything in their reading history. A reader with no history
 * (or one whose history doesn't score against anything left) still gets a
 * full `limit`, backfilled with the most recently published unread works —
 * this always has something to show, never an empty state for its own sake.
 */
export async function getRecommendationsForUser(userId: string, limit = 5): Promise<Work[]> {
  const sql = getDb();

  const historyRows = (await sql`
    select f.* from reading_history rh
    join works_feed f on f.id = rh.work_id
    where rh.user_id = ${userId}
  `) as unknown as Work[];

  const candidateRows = (await sql`select * from works_feed where is_active = true`) as unknown as Work[];

  const readIds = new Set(historyRows.map((w) => w.id));
  const candidates = candidateRows.filter((c) => !readIds.has(c.id));

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: historyRows.reduce((max, read) => Math.max(max, scoreOverlap(read, candidate)), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || byRecency(a.candidate, b.candidate))
    .map(({ candidate }) => candidate);

  if (scored.length >= limit) return scored.slice(0, limit);

  const scoredIds = new Set(scored.map((w) => w.id));
  const fillers = candidates.filter((c) => !scoredIds.has(c.id)).sort(byRecency);
  return [...scored, ...fillers].slice(0, limit);
}
