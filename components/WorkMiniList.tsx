import Link from "next/link";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { AuthorMark } from "@/components/AuthorMark";
import type { Work } from "@/lib/types";

/** A row of small author-mark + title/author links — the shared building block behind SimilarWorks and RecommendedWorks. */
export function WorkMiniList({ works, columns = "sm:grid-cols-3" }: { works: Work[]; columns?: string }) {
  return (
    <ul className={`grid grid-cols-1 gap-5 ${columns}`}>
      {works.map((work) => {
        const accent = CATEGORY_ACCENT[work.category];
        return (
          <li key={work.id}>
            <Link href={`/work/${work.id}`} className="group flex items-center gap-3">
              <AuthorMark
                portraitUrl={work.author_portrait_url}
                authorName={work.author}
                accentBg={accent.bg}
                accentText={accent.text}
                className="h-14 w-14 shrink-0"
                initialSizeClassName="text-xl"
              />
              <span>
                <span className="block font-serif text-sm leading-tight transition-colors group-hover:text-ink-soft">
                  {work.title}
                </span>
                <span className="block text-xs text-ink-soft">{work.author}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
