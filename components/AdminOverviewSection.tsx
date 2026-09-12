import Link from "next/link";
import type { Candidate } from "@/lib/contentReview";
import type { PicksLogDay } from "@/lib/dailyPicks";
import { formatDisplayDate } from "@/lib/dateMath";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { Work, WorkCategory } from "@/lib/types";
import { TriggerPortraitsButton } from "@/components/TriggerPortraitsButton";
import { UploadPortraitButton } from "@/components/UploadPortraitButton";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};

// Reviewer/admin-only, rendered above the reading-history cards on
// /account (see ReadingHistorySection's adminContent prop). Three
// unrelated concerns — the review queue (user recommendations awaiting a
// human), what the daily pipeline has published, and the author-portrait
// gap — kept as separate cards in one scroll container.
export function AdminOverviewSection({
  pending,
  works,
  picksLog,
}: {
  pending: Candidate[];
  works: Work[];
  picksLog: PicksLogDay[];
}) {
  const missingPortraitAuthors = [
    ...new Set(works.filter((w) => !w.author_portrait_url).map((w) => w.author)),
  ].sort();

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
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Daily picks
          </h2>
        </div>
        <div className="max-h-72 overflow-y-auto p-5">
          {picksLog.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing published yet.</p>
          ) : (
            <ul className="space-y-3">
              {picksLog.map((day) => (
                <li key={day.date}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">No. {day.day}</span>
                    <span className="text-xs text-ink-soft">
                      {formatDisplayDate(day.date)}
                      {day.complete ? "" : " · incomplete"}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {day.works.map((w) => (
                      <li key={w.category} className="flex items-center gap-2 text-sm">
                        <span
                          className={`h-2 w-2 shrink-0 ${CATEGORY_ACCENT[w.category].bg}`}
                          aria-hidden="true"
                        />
                        <span className="truncate font-serif text-ink">{w.title}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="shrink-0 border border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 px-5 py-3">
          <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Catalog
          </h2>
        </div>
        <div className="max-h-72 overflow-y-auto p-5">
          {missingPortraitAuthors.length > 0 && (
            <div className="mb-4 border-b border-ink/10 pb-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {missingPortraitAuthors.length} author
                  {missingPortraitAuthors.length === 1 ? "" : "s"} missing a portrait
                </p>
                <TriggerPortraitsButton />
              </div>
              <ul className="space-y-1">
                {missingPortraitAuthors.map((name) => (
                  <li key={name} className="flex items-center justify-between gap-3">
                    <span className="truncate font-serif text-sm">{name}</span>
                    <UploadPortraitButton authorName={name} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {CATEGORIES.map((category) => {
            const inCategory = works.filter((w) => w.category === category);
            return (
              <div key={category} className="mb-4 last:mb-0">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                  <span
                    className={`h-2 w-2 shrink-0 ${CATEGORY_ACCENT[category].bg}`}
                    aria-hidden="true"
                  />
                  {CATEGORY_LABEL[category]} · {inCategory.length}
                </p>
                {inCategory.length === 0 ? (
                  <p className="text-sm text-ink-soft">None yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {inCategory.map((work) => (
                      <li key={work.id} className="truncate font-serif text-sm">
                        {work.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
