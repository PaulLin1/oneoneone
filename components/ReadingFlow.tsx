import { ReadingHead } from "@/components/ReadingHead";
import { ReadingView } from "@/components/ReadingView";
import type { Work, WorkCategory } from "@/lib/types";

/**
 * The shared reading chrome (running head, reading view) for reading
 * through a day's three works.
 * Navigating between the three happens via the running head's day strip —
 * no separate Next/Done button, so the reading area gets the space instead.
 */
export function ReadingFlow({
  work,
  category,
  dayNumber,
  backHref,
  backLabel,
  progressHrefs,
}: {
  work: Work;
  category: WorkCategory;
  /** The edition number shown in the running head. */
  dayNumber: number;
  backHref: string;
  backLabel: string;
  progressHrefs: Record<WorkCategory, string>;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <ReadingHead
        backHref={backHref}
        backLabel={backLabel}
        category={category}
        progressHrefs={progressHrefs}
      />

      <div className="flex-1 overflow-y-auto py-10">
        <ReadingView work={work} dayNumber={dayNumber} />
      </div>
    </main>
  );
}
