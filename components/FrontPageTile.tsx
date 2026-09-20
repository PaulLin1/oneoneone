import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { AuthorMark } from "@/components/AuthorMark";
import type { Work, WorkCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

const CATEGORY_NUMBER: Record<WorkCategory, string> = {
  poem: "01",
  essay: "02",
  story: "03",
};

/**
 * One front-page lead — a numbered square, a large author-mark block, and a
 * short editorial description (not an excerpt of the text itself: that's
 * what work.description is written for). Three of these side by side, full
 * bleed, are the whole home page.
 */
export function FrontPageTile({
  category,
  work,
  href,
}: {
  category: WorkCategory;
  work: Work;
  href?: string;
}) {
  const accent = CATEGORY_ACCENT[category];

  return (
    <Link
      href={href ?? `/read/${category}`}
      className="group flex flex-col px-6 py-8 transition-colors hover:bg-ink/[0.02] sm:px-8 sm:py-9"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-ink text-xs text-ink-soft">
          {CATEGORY_NUMBER[category]}
        </span>
        <span className="text-xs text-ink-soft">
          {CATEGORY_LABEL[category]} · ~{work.reading_minutes} min
        </span>
      </div>

      <AuthorMark
        portraitUrl={work.author_portrait_url}
        authorName={work.author}
        accentBg={accent.bg}
        accentText={accent.text}
        className="mt-6 h-56 w-full sm:h-64"
        initialSizeClassName="text-7xl sm:text-8xl"
      />

      <h2 className="mt-6 font-serif text-2xl leading-tight sm:text-[1.9rem]">{work.title}</h2>
      <p className="mt-2 text-sm text-ink-soft">
        {work.author}
        {work.year ? ` · ${work.year}` : ""}
      </p>
      <p className="mt-5 font-serif text-[0.95rem] leading-relaxed text-ink">{work.description}</p>
      <span className="mt-6 text-sm text-ink transition-colors group-hover:text-ink-soft">Read →</span>
    </Link>
  );
}
