import { ReadingHead } from "@/components/ReadingHead";
import { ReadingView } from "@/components/ReadingView";
import { DayStrip } from "@/components/DayStrip";
import { SimilarWorks } from "@/components/SimilarWorks";
import { getSimilarWorks } from "@/lib/recommendations";
import type { Work, WorkCategory } from "@/lib/types";

/**
 * The shared reading chrome (running head, reading view, day strip) for
 * reading through a day's three works — used by both today's flow and
 * every archive day's flow, so format changes only need to happen once
 * here. Navigating between the three happens via the day strip itself —
 * no separate Next/Done button, so the reading area gets the space instead.
 */
export async function ReadingFlow({
  work,
  category,
  readDate,
  source,
  sourceDate,
  dayNumber,
  backHref,
  backLabel,
  progressHrefs,
}: {
  work: Work;
  category: WorkCategory;
  /** Which calendar day this read counts toward — see ReadingView. */
  readDate: string;
  /** How this read happened — see ReadingView. */
  source: "daily" | "random" | "archive";
  sourceDate?: string;
  /** The edition number shown in the running head — today's, or the archived day's. */
  dayNumber: number;
  backHref: string;
  backLabel: string;
  progressHrefs: Record<WorkCategory, string>;
}) {
  const similar = await getSimilarWorks(work.id);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <ReadingHead
        backHref={backHref}
        backLabel={backLabel}
        dayNumber={dayNumber}
        category={category}
        readingMinutes={work.reading_minutes}
      />

      <div className="flex-1 overflow-y-auto py-10">
        <ReadingView work={work} readDate={readDate} source={source} sourceDate={sourceDate} />
        <SimilarWorks works={similar} />
      </div>

      <div className="shrink-0 border-t border-ink/10 py-6">
        <DayStrip current={category} hrefs={progressHrefs} />
      </div>
    </main>
  );
}
