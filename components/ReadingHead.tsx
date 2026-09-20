import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { WorkCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

/** The slim running head above a reading page: back link, edition number, category, read time. */
export function ReadingHead({
  backHref,
  backLabel,
  dayNumber,
  category,
  readingMinutes,
}: {
  backHref: string;
  backLabel: string;
  dayNumber: number;
  category: WorkCategory;
  readingMinutes: number;
}) {
  const accent = CATEGORY_ACCENT[category];

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 py-4">
      <Link href={backHref} className="text-sm text-ink-soft transition-colors hover:text-ink">
        ← {backLabel}
      </Link>
      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span>No. {dayNumber}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 ${accent.bg}`} aria-hidden="true" />
          {CATEGORY_LABEL[category]}
        </span>
        <span aria-hidden="true">·</span>
        <span>~{readingMinutes} min</span>
      </div>
    </div>
  );
}
