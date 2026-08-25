import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { todayIso } from "@/lib/dateMath";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = ["daily", "random", "archive"];

/**
 * Fired by ReadingView on every mount, signed in or not — anonymous
 * readers hit this same endpoint, which just no-ops for them. Keeping the
 * "am I signed in" check server-side (rather than gating the fetch client-
 * side via useSession()) means ReadingView doesn't need a SessionProvider
 * wrapping the app just for this one call.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response(null, { status: 204 });
  }

  const body = await request.json().catch(() => null);
  const workId = body?.workId;
  if (typeof workId !== "string" || workId.length === 0) {
    return Response.json({ error: "Missing workId" }, { status: 400 });
  }

  // Which slot this fills — today for the live page and /work/[id], or the
  // day being read for an archive page (see ReadingView's readDate prop).
  // Falls back to today for a stale client that never sends one, and
  // ignores a future date rather than erroring, same "don't fight a
  // best-effort background call" spirit as the try/catch around the fetch
  // itself in ReadingView.
  const date = typeof body?.date === "string" && DATE_RE.test(body.date) ? body.date : todayIso();
  const readDate = date <= todayIso() ? date : todayIso();

  const source = SOURCES.includes(body?.source) ? body.source : "daily";
  // Only meaningful for source === 'archive' — the day the pick is
  // actually from, as opposed to readDate (the day it was opened).
  const sourceDate =
    source === "archive" && typeof body?.sourceDate === "string" && DATE_RE.test(body.sourceDate)
      ? body.sourceDate
      : null;

  const sql = getDb();
  // insert ... select — if workId doesn't match a real work this is a
  // silent no-op (0 rows selected), same as the old route's behavior was
  // for a fabricated id via the FK constraint, just without the error.
  if (source === "daily") {
    // 'daily' is a singleton per (user, category, day) — see 0009: unlike
    // random/archive/external, there's only ever supposed to be *one*
    // "today's official pick." selectDailyWorks() is recomputed from the
    // live catalog on every request, so if the active-works set changes
    // partway through the day, a later read here can land on a genuinely
    // different work than an earlier one — replace the old "daily" row
    // rather than sitting a second one beside it (which is what caused
    // the duplicate-daily bug 0009 cleaned up).
    await sql`
      insert into reading_history (user_id, category, read_date, work_id, source)
      select ${session.user.id}, w.category, ${readDate}, w.id, 'daily'
      from works w where w.id = ${workId}
      on conflict (user_id, category, read_date) where source = 'daily' do update
        set work_id = excluded.work_id, read_at = now()
    `;
  } else {
    // random/archive — reopening the exact same work in the same slot just
    // bumps read_at (the partial unique index in 0008), it doesn't create
    // a second row; a *different* work does, since those sources can
    // legitimately hold several reads a day.
    await sql`
      insert into reading_history (user_id, category, read_date, work_id, source, source_date)
      select ${session.user.id}, w.category, ${readDate}, w.id, ${source}, ${sourceDate}
      from works w where w.id = ${workId}
      on conflict (user_id, category, read_date, work_id) where work_id is not null do update
        set source = excluded.source, source_date = excluded.source_date, read_at = now()
    `;
  }

  return new Response(null, { status: 204 });
}
