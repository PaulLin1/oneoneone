"use client";

import { useEffect } from "react";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { AuthorMark } from "@/components/AuthorMark";
import type { Work } from "@/lib/types";

const CATEGORY_LABEL: Record<Work["category"], string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Short Story",
};

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
  dayNumber,
}: {
  work: Work;
  readDate: string;
  source: "daily" | "random" | "archive";
  sourceDate?: string;
  /** The edition number this reading belongs to — today's, or the archived day's. */
  dayNumber: number;
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
    // Below lg this is a single centered column (portrait, title, byline,
    // note, body, source — in that order), like a printed page. From lg up,
    // everything *about* the work breaks out into a sticky sidebar on the
    // left, leaving the right column as nothing but the reading itself.
    <article className="mx-auto max-w-5xl lg:flex lg:items-start lg:gap-16">
      <aside className="mb-10 flex flex-col items-center text-center lg:sticky lg:top-6 lg:mb-0 lg:w-64 lg:shrink-0 lg:items-start lg:text-left">
        <AuthorMark
          portraitUrl={work.author_portrait_url}
          authorName={work.author}
          accentBg={accent.bg}
          accentText={accent.text}
          className="h-40 w-40 overflow-hidden sm:h-48 sm:w-48 lg:h-36 lg:w-36"
          initialSizeClassName="text-6xl sm:text-7xl"
        />

        <h1 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl lg:text-2xl">
          {work.title}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {work.author}
          {work.year ? ` · ${work.year}` : ""}
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          No. {dayNumber} · {CATEGORY_LABEL[work.category]} · ~{work.reading_minutes} min
        </p>
        {work.author_note && (
          <p className="mt-4 font-serif text-sm italic text-ink-soft">{work.author_note}</p>
        )}

        <p className="mt-6 text-xs text-ink-soft">
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
      </aside>

      <div className="lg:min-w-0 lg:flex-1">
        {isPoem ? (
          <p className="whitespace-pre-line text-center font-serif text-lg leading-loose lg:text-left">
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
    </article>
  );
}
