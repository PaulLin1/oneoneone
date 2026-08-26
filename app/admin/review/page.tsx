import Link from "next/link";
import { auth } from "@/lib/auth";
import { listPendingCandidates } from "@/lib/contentReview";

export default async function ReviewQueuePage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center gap-2 px-6 text-center sm:px-10">
        <h1 className="text-2xl tracking-tight">Not authorized</h1>
        <p className="font-serif text-sm text-ink-soft">
          This page is for signed-in reviewers only.
        </p>
      </main>
    );
  }

  const candidates = await listPendingCandidates();

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <h1 className="text-3xl tracking-tight sm:text-4xl">Review queue</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {candidates.length} candidate{candidates.length === 1 ? "" : "s"} awaiting review
        </p>
      </div>

      {candidates.length === 0 ? (
        <p className="border-t border-ink/15 pt-10 font-serif text-sm text-ink-soft">
          Nothing waiting — the scheduled pipeline (or the next recommendation) will land here.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10 border-t border-ink/15">
          {candidates.map((c) => (
            <li key={c.id} className="py-4">
              <Link href={`/admin/review/${c.id}`} className="block hover:opacity-70">
                <p className="font-serif text-base">{c.title}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {c.author_name} · {c.category} · {c.origin}
                  {c.origin === "user_submitted" && !c.text_content ? " · needs text sourced" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
