import Link from "next/link";
import { auth, signIn } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SignOutForm } from "@/components/SignOutForm";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { formatDisplayDate } from "@/lib/dateMath";
import type { WorkCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

type HistoryRow = {
  id: string;
  title: string;
  author: string;
  category: WorkCategory;
  read_at: string;
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center sm:px-10 sm:py-20">
        <h1 className="text-3xl tracking-tight sm:text-4xl">Account</h1>
        <p className="max-w-md font-serif text-base leading-relaxed text-ink-soft">
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
            className="bg-yellow px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80"
          >
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  const sql = getDb();
  const history = (await sql`
    select w.id, w.title, a.name as author, w.category, rh.read_at
    from reading_history rh
    join works w on w.id = rh.work_id
    join authors a on a.id = w.author_id
    where rh.user_id = ${session.user.id}
    order by rh.read_at desc
    limit 200
  `) as unknown as HistoryRow[];

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-tight sm:text-4xl">Account</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {session.user.email}
            {session.user.role !== "reader" && (
              <span className="ml-2 uppercase tracking-[0.1em]">· {session.user.role}</span>
            )}
          </p>
        </div>
        <SignOutForm />
      </div>

      <div className="space-y-6 border-t border-black/15 pt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Reading history
          </h2>
          <Link
            href="/recommend"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
          >
            Recommend a work →
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="font-serif text-sm text-ink-soft">
            Nothing recorded yet — reading history is added the moment you open a work while
            signed in.
          </p>
        ) : (
          <ul className="divide-y divide-black/10">
            {history.map((row) => {
              const accent = CATEGORY_ACCENT[row.category];
              return (
                <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base">{row.title}</p>
                    <p className="truncate text-xs text-ink-soft">{row.author}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${accent.bg} ${accent.text}`}
                    >
                      {CATEGORY_LABEL[row.category]}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {formatDisplayDate(row.read_at.slice(0, 10))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
