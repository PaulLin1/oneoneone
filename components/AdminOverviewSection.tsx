import Link from "next/link";
import type { Candidate } from "@/lib/contentReview";
import type { CatalogUsage } from "@/lib/selection/algorithm";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { WorkCategory } from "@/lib/types";
import { FetchCandidatesButton } from "@/components/FetchCandidatesButton";
import { TriggerPortraitsButton } from "@/components/TriggerPortraitsButton";
import { UploadPortraitButton } from "@/components/UploadPortraitButton";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};

// Reviewer/admin-only, rendered above the reading-history cards on
// /account (see ReadingHistorySection's adminContent prop) — the two
// concerns (what you've read vs. what's in the review queue/catalog)
// don't share data, so they're kept as separate components even though
// they land in the same scroll container.
export function AdminOverviewSection({
  pending,
  usage,
}: {
  pending: Candidate[];
  usage: Record<WorkCategory, CatalogUsage[]>;
}) {
  const missingPortraitAuthors = new Set(
    Object.values(usage)
      .flat()
      .filter((u) => !u.work.author_portrait_url)
      .map((u) => u.work.author)
  );

  return (
    <>
      <section className="shrink-0 border border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 px-5 py-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Review queue
          </h2>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <FetchCandidatesButton />
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing waiting.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {pending.slice(0, 8).map((c) => (
                <li key={c.id} className="py-2 first:pt-0 last:pb-0">
                  <Link href={`/admin/review/${c.id}`} className="block hover:opacity-70">
                    <p className="truncate font-serif text-sm">{c.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {c.author_name} · {c.category}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && (
            <Link
              href="/admin/review"
              className="mt-4 inline-block border border-ink px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Review all ({pending.length}) →
            </Link>
          )}
        </div>
      </section>

      <section className="shrink-0 border border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 px-5 py-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Catalog</h2>
        </div>
        <div className="max-h-72 overflow-y-auto p-5">
          {missingPortraitAuthors.size > 0 && (
            <div className="mb-4 border-b border-ink/10 pb-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {missingPortraitAuthors.size} author{missingPortraitAuthors.size === 1 ? "" : "s"} missing a
                  portrait
                </p>
                <TriggerPortraitsButton />
              </div>
              <ul className="space-y-1">
                {[...missingPortraitAuthors].map((name) => (
                  <li key={name} className="flex items-center justify-between gap-3">
                    <span className="truncate font-serif text-sm">{name}</span>
                    <UploadPortraitButton authorName={name} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {CATEGORIES.map((category) => (
            <div key={category} className="mb-4 last:mb-0">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                <span className={`h-2 w-2 shrink-0 ${CATEGORY_ACCENT[category].bg}`} aria-hidden="true" />
                {CATEGORY_LABEL[category]} · {usage[category].length}
              </p>
              {usage[category].length === 0 ? (
                <p className="text-sm text-ink-soft">None approved yet.</p>
              ) : (
                <ul className="space-y-1">
                  {usage[category].map(({ work, used }) => (
                    <li key={work.id} className="flex items-center justify-between gap-3">
                      <span className="truncate font-serif text-sm">{work.title}</span>
                      <span
                        className={`shrink-0 text-[10px] uppercase tracking-[0.1em] ${
                          used ? "text-ink-soft" : "text-ink"
                        }`}
                      >
                        {used ? "Used" : "Not yet"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
