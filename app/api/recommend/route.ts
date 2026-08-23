import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const RecommendSchema = z.object({
  title: z.string().trim().min(1).max(200),
  authorName: z.string().trim().min(1).max(200),
  category: z.enum(["poem", "essay", "story"]),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional(),
});

/**
 * A recommendation is a stub, not a ready candidate: text_content stays
 * null (there's no promise the submitter has verbatim, verified text —
 * see seed/README.md's sourcing rules), so this is only ever a starting
 * point for review, never something that could accidentally get promoted
 * as-is (scripts/promote-candidate.ts already refuses to promote without
 * text_content, description, and now source_url too).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Sign in to recommend a work." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RecommendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { title, authorName, category, sourceUrl, note } = parsed.data;
  const sql = getDb();

  // reviewer_notes carries the submitter's own note, clearly labeled as
  // such — description stays null rather than reusing this field for it,
  // since description is editorial copy a reviewer writes about the work
  // itself (see seed/README.md), not the recommender's personal pitch.
  const reviewerNotes = note ? `Submitter note: ${note}` : null;

  await sql`
    insert into content_candidates (
      title, author_name, category, source_name, source_url,
      reviewer_notes, tags, origin, status, submitted_by
    ) values (
      ${title}, ${authorName}, ${category}, 'User recommendation',
      ${sourceUrl || null}, ${reviewerNotes}, '{}', 'user_submitted',
      'needs_review', ${session.user.id}
    )
  `;

  return Response.json({ ok: true });
}
