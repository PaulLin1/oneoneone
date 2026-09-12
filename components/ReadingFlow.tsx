import Link from "next/link";
import { ReadingView } from "@/components/ReadingView";
import { ReadingProgress } from "@/components/ReadingProgress";
import type { Work, WorkCategory } from "@/lib/types";

/**
 * The shared stepper chrome (back link, progress boxes, reading view) for
 * reading through a day's three works — used by both today's flow and
 * every archive day's flow, so format changes only need to happen once
 * here. Navigating between the three happens via the progress boxes
 * themselves — no separate Next/Done button, so the reading area gets the
 * space instead.
 */
export function ReadingFlow({
  work,
  category,
  readDate,
  source,
  sourceDate,
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
  backHref: string;
  backLabel: string;
  progressHrefs: Record<WorkCategory, string>;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <div className="flex shrink-0 items-center justify-between gap-4 py-6">
        <Link href={backHref} className="text-base text-ink-soft transition-colors hover:text-ink">
          ← {backLabel}
        </Link>
        <div className="flex items-center gap-4">
          <ReadingProgress current={category} hrefs={progressHrefs} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-10">
        <ReadingView work={work} readDate={readDate} source={source} sourceDate={sourceDate} />
      </div>
    </main>
  );
}
