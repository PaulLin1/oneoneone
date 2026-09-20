"use client";

import { useEffect } from "react";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { AuthorMark } from "@/components/AuthorMark";
import type { Work } from "@/lib/types";

/**
 * `readDate` is which calendar slot this read counts toward — always the
 * day it's actually opened (today, for every caller), never the day an
 * archived work's selection is *from*. `source`/`sourceDate` carry that
 * distinction instead: reading archive day N's pick today still counts
 * toward today, tagged as `source: "archive", sourceDate: <day N's date>`
 * so /account can show "from <date>" rather than presenting it as today's
 * canonical pick.
 */
export function ReadingView({
  work,
  readDate,
  source,
  sourceDate,
}: {
  work: Work;
  readDate: string;
  source: "daily" | "random" | "archive";
  sourceDate?: string;
}) {
  const isPoem = work.category === "poem";
  const accent = CATEGORY_ACCENT[work.category];

  // Records reading history for signed-in readers only — the API no-ops
  // for anonymous requests (see app/api/reading-history/route.ts), so this
  // fires unconditionally rather than needing a client-side session check.
  // Fires for every work viewed here, including archive reads, since both
  // routes render through this same component. A slot can hold more than
  // one read now (see 0008) — this never overwrites a different work
  // already logged for the same day/category, it only adds or, if it's
  // the exact same work, bumps read_at.
  useEffect(() => {
    fetch("/api/reading-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: work.id, date: readDate, source, sourceDate }),
    }).catch(() => {});
  }, [work.id, readDate, source, sourceDate]);

  const paragraphs = work.text_content?.split("\n\n") ?? [];

  return (
    // A single centered column, like a printed page — the portrait sits as
    // a small square stamp beside the title instead of a large sidebar
    // avatar, so the reading itself gets almost the whole page.
    <article className="mx-auto max-w-[46rem]">
      <div className="flex items-end gap-6">
        <AuthorMark
          portraitUrl={work.author_portrait_url}
          authorName={work.author}
          accentBg={accent.bg}
          accentText={accent.text}
          className="h-24 w-24 shrink-0 overflow-hidden sm:h-28 sm:w-28"
          initialSizeClassName="text-4xl sm:text-5xl"
        />
        <div>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{work.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {work.author}
            {work.year ? ` · ${work.year}` : ""}
          </p>
        </div>
      </div>
      {work.author_note && (
        <p className="mt-4 font-serif text-sm italic text-ink-soft">{work.author_note}</p>
      )}

      <div className="mt-10">
        {isPoem ? (
          <p className="whitespace-pre-line text-center font-serif text-lg leading-loose">
            {work.text_content}
          </p>
        ) : (
          <div className="prose prose-lg prose-reading font-serif">
            {paragraphs.map((paragraph, i) =>
              i === 0 ? (
                <p key={i}>
                  <span
                    aria-hidden="true"
                    className="float-left mr-2.5 pt-1 font-serif text-[3.4rem] leading-[0.8]"
                  >
                    {paragraph.charAt(0)}
                  </span>
                  {paragraph.slice(1)}
                </p>
              ) : (
                <p key={i}>{paragraph}</p>
              )
            )}
          </div>
        )}
      </div>

      <p className="mt-10 border-t border-ink/10 pt-6 text-xs text-ink-soft">
        Source:{" "}
        <a
          href={work.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
        >
          {work.source_name}
        </a>
        {work.public_domain ? " · Public domain" : ""}
      </p>
    </article>
  );
}
