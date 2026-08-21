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
  backHref,
  backLabel,
  progressHrefs,
  shuffle,
}: {
  work: Work;
  category: WorkCategory;
  backHref: string;
  backLabel: string;
  progressHrefs: Record<WorkCategory, string>;
  /** Opt-in per-reader alternate pick — only wired into today's /read flow, never archive. */
  shuffle?: { isRandomized: boolean; onShuffle: () => void; onReset: () => void };
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <div className="flex shrink-0 items-center justify-between gap-4 py-6">
        <Link href={backHref} className="text-base text-ink-soft transition-colors hover:text-ink">
          ← {backLabel}
        </Link>
        <div className="flex items-center gap-4">
          {shuffle && (
            <button
              type="button"
              onClick={shuffle.isRandomized ? shuffle.onReset : shuffle.onShuffle}
              className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft underline decoration-black/20 underline-offset-4 transition-colors hover:text-ink"
            >
              {shuffle.isRandomized ? "Back to today's pick" : "Shuffle"}
            </button>
          )}
          <ReadingProgress current={category} hrefs={progressHrefs} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border-t border-black/15 py-10">
        <ReadingView work={work} />
      </div>
    </main>
  );
}
