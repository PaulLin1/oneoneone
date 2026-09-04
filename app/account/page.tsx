import { auth, signIn } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SignOutForm } from "@/components/SignOutForm";
import { ReadingHistorySection } from "@/components/ReadingHistorySection";
import { AdminOverviewSection } from "@/components/AdminOverviewSection";
import { todayIso } from "@/lib/dateMath";
import type { ReadingHistoryEntry } from "@/lib/readingCalendar";
import { listPendingCandidates } from "@/lib/contentReview";
import { catalogUsage } from "@/lib/selection/algorithm";
import type { Work } from "@/lib/types";

// How far back the /account calendar reaches — a bit more than this in
// practice, since buildReadingCalendar aligns outward to whole weeks.
const CALENDAR_WEEKS = 14;

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="w-full max-w-md border-2 border-ink">
          <div className="h-2.5 bg-link" aria-hidden="true" />
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-10">
            <h1 className="text-3xl tracking-tight sm:text-4xl">Account</h1>
            <p className="font-serif text-base leading-relaxed text-ink-soft">
              Entirely optional — the daily three, Archive, and Shuffle all work exactly the same
              without one. An account only adds a running record of what you&apos;ve read and the
              ability to recommend works for the catalog.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button
                type="submit"
                className="rounded-full border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Sign in with Google
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const today = todayIso();
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (CALENDAR_WEEKS * 7 + 7));
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const sql = getDb();
  const rows = (await sql`
    select
      rh.id,
      to_char(rh.read_date, 'YYYY-MM-DD') as date,
      rh.category,
      coalesce(w.title, rh.external_title) as title,
      coalesce(a.name, rh.external_author) as author,
      rh.work_id,
      rh.source,
      to_char(rh.source_date, 'YYYY-MM-DD') as source_date
    from reading_history rh
    left join works w on w.id = rh.work_id
    left join authors a on a.id = w.author_id
    where rh.user_id = ${session.user.id} and rh.read_date >= ${cutoffIso}
    order by rh.read_date desc, rh.read_at desc
  `) as unknown as {
    id: string;
    date: string;
    category: ReadingHistoryEntry["category"];
    title: string;
    author: string | null;
    work_id: string | null;
    source: ReadingHistoryEntry["source"];
    source_date: string | null;
  }[];

  const history: ReadingHistoryEntry[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    category: r.category,
    title: r.title,
    author: r.author,
    workId: r.work_id,
    source: r.source,
    sourceDate: r.source_date,
  }));

  // Review queue + catalog usage are reviewer/admin-only and cost an extra
  // couple of queries — skip them entirely for the common case (a plain
  // reader) rather than computing something that's never rendered.
  const isReviewer = session.user.role === "reviewer" || session.user.role === "admin";
  let adminContent = null;
  if (isReviewer) {
    const [pending, worksRows] = await Promise.all([
      listPendingCandidates(),
      sql`select * from works_feed where is_active = true`,
    ]);
    const works = worksRows as unknown as Work[];
    adminContent = <AdminOverviewSection pending={pending} usage={catalogUsage(works, today)} />;
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-6 sm:px-10 sm:py-8">
      <div className="mb-6 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-tight sm:text-4xl">Account</h1>
          <div className="mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-soft">
            {session.user.email}
            {session.user.role !== "reader" && (
              <span className="ml-2 uppercase tracking-[0.1em]">· {session.user.role}</span>
            )}
          </p>
        </div>
        <SignOutForm />
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-ink/15 pt-6">
        <ReadingHistorySection
          today={today}
          weeks={CALENDAR_WEEKS}
          initialHistory={history}
          adminContent={adminContent}
        />
      </div>
    </main>
  );
}
