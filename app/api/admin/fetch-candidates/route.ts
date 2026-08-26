import { auth } from "@/lib/auth";
import { fetchCandidates } from "@/lib/fetchCandidates";
import { dispatchWorkflow } from "@/lib/githubDispatch";

const PER_CATEGORY_LIMIT = 7;

// Default serverless timeout (10s on Vercel Hobby) is too short for a
// batch of sequential external fetches (Gutenberg/Wikisource pages can
// each take a few seconds, and this can now stage up to 21 — 7 per
// category) — this only raises the ceiling, it doesn't make individual
// runs slower.
export const maxDuration = 120;

/**
 * The "Fetch new candidates" button on /account. Tries the fast, free,
 * non-agent path first — sampling seed/source-pool.json directly, same as
 * `npm run fetch-candidates` — and returns instantly if that finds
 * anything. That pool is a small, finite, hand-vetted list, though: it
 * will eventually run dry no matter how much it's grown, because finding
 * genuinely new sources needs real web search and judgment (is this
 * actually public domain? does this URL resolve to the work itself, not
 * an index page?), not just sampling a fixed file. When the pool comes up
 * empty, this automatically falls back to dispatching content-pipeline.yml
 * in fetch-only mode — the real discovery step, done by an agent with
 * WebSearch, on GitHub's infrastructure rather than a Vercel function.
 * That part isn't instant (a few minutes) and isn't free (real API usage,
 * capped — see the workflow file), which is exactly why it's a fallback
 * and not the default path.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await fetchCandidates(PER_CATEGORY_LIMIT);
  if (result.staged.length > 0) {
    return Response.json({ ...result, deeperSearchStarted: false });
  }

  const dispatch = await dispatchWorkflow("content-pipeline.yml", { mode: "fetch-only" });
  if ("error" in dispatch) {
    // Pool was empty and we couldn't even start the fallback — still a
    // real result (not an error), just say so plainly.
    return Response.json({ ...result, deeperSearchStarted: false, deeperSearchError: dispatch.error });
  }

  return Response.json({ ...result, deeperSearchStarted: true });
}
