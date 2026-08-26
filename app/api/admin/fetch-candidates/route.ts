import { auth } from "@/lib/auth";
import { fetchCandidates } from "@/lib/fetchCandidates";

const PER_CATEGORY_LIMIT = 7;

// Default serverless timeout (10s on Vercel Hobby) is too short for a
// batch of sequential external fetches (Gutenberg/Wikisource pages can
// each take a few seconds, and this can now stage up to 21 — 7 per
// category) — this only raises the ceiling, it doesn't make individual
// runs slower.
export const maxDuration = 120;

/**
 * The "Fetch new candidates" button on /account — same underlying function
 * as `npm run fetch-candidates`, just triggered from the UI instead of a
 * terminal. Nothing here is promoted or made live; it only stages rows
 * into content_candidates for a human to review.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await fetchCandidates(PER_CATEGORY_LIMIT);
  return Response.json(result);
}
