import { auth, signIn } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SignOutForm } from "@/components/SignOutForm";
import { ReadingHistorySection } from "@/components/ReadingHistorySection";
import { todayIso } from "@/lib/dateMath";
import type { ReadingHistoryEntry } from "@/lib/readingCalendar";

// How far back the /account calendar reaches — a bit more than this in
// practice, since buildReadingCalendar aligns outward to whole weeks.
const CALENDAR_WEEKS = 14;

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="flex w-full max-w-md flex-col items-center gap-4 py-10 text-center">
          <div>
            <h1 className="text-4xl tracking-tight sm:text-5xl">Account</h1>
            <div className="mx-auto mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
          </div>
          <p className="font-serif text-base leading-relaxed text-ink-soft">
            Entirely optional — the daily three and Archive work exactly the same without one. An
            account only adds a running record of what you&apos;ve read.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:underline"
            >
              Sign in with Google
            </button>
          </form>
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

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-6 sm:px-10 sm:py-8">
      <div className="mb-6 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl tracking-tight sm:text-5xl">Account</h1>
          <div className="mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-soft">{session.user.email}</p>
        </div>
        <SignOutForm />
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-6">
        <ReadingHistorySection today={today} weeks={CALENDAR_WEEKS} initialHistory={history} />
      </div>
    </main>
  );
}
