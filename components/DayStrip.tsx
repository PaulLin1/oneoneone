import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};
const CATEGORY_NUMBER: Record<WorkCategory, string> = {
  poem: "01",
  essay: "02",
  story: "03",
};

/**
 * The three square tiles a reader moves between the day's poem/essay/story
 * with — the current one filled with its category accent, the other two
 * outlined. Same square motif as FrontPageTile's numbered marks, doubling
 * as a plain in-page nav rather than a progress indicator.
 */
export function DayStrip({
  current,
  hrefs,
}: {
  current: WorkCategory;
  hrefs: Record<WorkCategory, string>;
}) {
  return (
    <nav aria-label="Today's three" className="flex justify-center gap-3 sm:gap-4">
      {ORDER.map((category) => {
        const isCurrent = category === current;
        const accent = CATEGORY_ACCENT[category];
        return (
          <Link
            key={category}
            href={hrefs[category]}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex h-20 w-20 flex-col justify-between border border-ink p-2.5 transition-opacity hover:opacity-80 sm:h-24 sm:w-24 sm:p-3 ${
              isCurrent ? `${accent.bg} ${accent.text}` : "text-ink-soft"
            }`}
          >
            <span className="text-sm">{CATEGORY_NUMBER[category]}</span>
            <span className="text-xs">{CATEGORY_LABEL[category]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
