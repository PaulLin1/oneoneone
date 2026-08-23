import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  const sql = getDb();
  await sql`
    insert into reading_history (user_id, work_id)
    values (${session.user.id}, ${workId})
    on conflict (user_id, work_id) do update set read_at = now()
  `;

  return new Response(null, { status: 204 });
}
