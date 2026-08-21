import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

export function ReadingProgress({
  current,
  hrefs,
}: {
  current: WorkCategory;
  hrefs: Record<WorkCategory, string>;
}) {
  return (
    <div className="flex items-center gap-2" aria-label="Reading progress">
      {ORDER.map((category) => {
        const isCurrent = category === current;
        const accent = CATEGORY_ACCENT[category];
        return (
          <Link
            key={category}
            href={hrefs[category]}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Jump to ${CATEGORY_LABEL[category]}`}
            className={`h-2.5 w-2.5 border border-ink transition-opacity hover:opacity-70 ${isCurrent ? accent.bg : "bg-transparent"}`}
          />
        );
      })}
    </div>
  );
}
