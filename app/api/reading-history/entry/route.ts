import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { todayIso } from "@/lib/dateMath";
import type { WorkCategory } from "@/lib/types";

/**
 * Manually logging something read outside the site, for a given (day,
 * category) slot on the /account reading calendar. Distinct from
 * app/api/reading-history/route.ts, which auto-logs a catalog work from
 * ReadingView — this route only ever creates 'external' rows (no work_id),
 * and since a slot can now hold several reads (see 0008), PUT always adds
 * a new row rather than replacing whatever was there.
 */

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isWorkCategory(value: unknown): value is WorkCategory {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

function isValidPastOrTodayDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && value <= todayIso();
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  const date = body?.date;

  if (!isWorkCategory(category)) {
    return Response.json({ error: "category must be one of poem, essay, story." }, { status: 400 });
  }
  if (!isValidPastOrTodayDate(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD and not in the future." }, { status: 400 });
  }

  const title = typeof body?.externalTitle === "string" ? body.externalTitle.trim() : "";
  if (!title) {
    return Response.json({ error: "Title is required for something read outside the site." }, { status: 400 });
  }
  const author = typeof body?.externalAuthor === "string" && body.externalAuthor.trim() ? body.externalAuthor.trim() : null;

  const sql = getDb();
  const rows = (await sql`
    insert into reading_history (user_id, category, read_date, work_id, external_title, external_author, source)
    values (${session.user.id}, ${category}, ${date}, null, ${title}, ${author}, 'external')
    returning id
  `) as unknown as { id: string }[];

  return Response.json({ id: rows[0].id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id query param is required." }, { status: 400 });
  }

  const sql = getDb();
  // Scoped to user_id so one reader can never clear another's row by id.
  await sql`delete from reading_history where id = ${id} and user_id = ${session.user.id}`;
  return new Response(null, { status: 204 });
}
