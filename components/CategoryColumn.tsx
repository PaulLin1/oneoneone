import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { AuthorMark, maskStyle } from "@/components/AuthorMark";
import { ScrollingTitle } from "@/components/ScrollingTitle";
import type { Work, WorkCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

// Fixed inset (not flex-computed) so the portrait renders at the exact same
// size on both faces — front and back have different surrounding content
// (title/meta vs. description), so sizing the mask off flex-1 made it
// compute a different box on each side. A fixed box sidesteps that.
//
// Percentage-based, not fixed pixels at two breakpoints: the card scales
// through three widths (w-64 / sm:w-80 / lg:w-96), and fixed-px insets drift
// out of proportion between them. A percentage box holds the same ratio
// continuously at every size instead of jumping at each breakpoint.
const PORTRAIT_BOX = "inset-x-[8%] top-[18%] bottom-[27%]";

export function CategoryColumn({
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
      className="group block w-64 shrink-0 sm:w-80 lg:w-96 [perspective:1600px]"
    >
      <div className="relative aspect-[5/7] w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Front — always shows a mark for the author, real portrait or a
            generated initial, so no work ever renders without one. */}
        <div className="absolute inset-0 flex flex-col overflow-hidden bg-paper text-center [backface-visibility:hidden]">
          <span
            className={`mx-5 mt-5 shrink-0 self-center px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] sm:mx-6 sm:mt-6 ${accent.bg} ${accent.text}`}
          >
            {CATEGORY_LABEL[category]}
          </span>

          <AuthorMark
            portraitUrl={work.author_portrait_url}
            authorName={work.author}
            accentBg={accent.bg}
            accentText={accent.text}
            className={`absolute ${PORTRAIT_BOX} [backface-visibility:hidden]`}
            initialSizeClassName="text-5xl sm:text-6xl"
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 sm:px-6 sm:pb-6">
            <h2 className="font-serif text-xl sm:text-2xl">
              <ScrollingTitle text={work.title} />
            </h2>
            <p className="mt-2 text-xs text-ink-soft sm:text-sm">
              {work.author}
              {work.year ? ` · ${work.year}` : ""} · ~{work.reading_minutes} min
            </p>
            <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              Read →
            </span>
          </div>
        </div>

        {/* Back — flips into view on hover */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-between overflow-hidden p-5 text-center sm:p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] ${accent.bg} ${accent.text}`}
        >
          {work.author_portrait_url && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute ${PORTRAIT_BOX} -scale-x-100 bg-white/15 [backface-visibility:hidden]`}
              style={maskStyle(work.author_portrait_url)}
            />
          )}
          <span className="relative shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
            {CATEGORY_LABEL[category]}
          </span>
          <div className="relative flex flex-1 items-center">
            <p className="text-sm leading-relaxed sm:text-base">{work.description}</p>
          </div>
          <span className="relative shrink-0 text-xs font-semibold uppercase tracking-[0.2em]">
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}
