import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};

/**
 * The three color-coded squares a reader moves between the day's
 * poem/essay/story with — the current one filled solid with its category
 * color, the other two outlined in their own color rather than a neutral
 * border, so color alone signifies which is which before you land on one.
 */
export function DayStrip({
  current,
  hrefs,
}: {
  current: WorkCategory;
  hrefs: Record<WorkCategory, string>;
}) {
  return (
    <nav aria-label="Today's three" className="flex items-center gap-1.5">
      {ORDER.map((category) => {
        const isCurrent = category === current;
        const accent = CATEGORY_ACCENT[category];
        return (
          <Link
            key={category}
            href={hrefs[category]}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={CATEGORY_LABEL[category]}
            className={`h-3 w-3 border-2 transition-opacity hover:opacity-70 ${accent.border} ${
              isCurrent ? accent.bg : "bg-transparent"
            }`}
          />
        );
      })}
    </nav>
  );
}
