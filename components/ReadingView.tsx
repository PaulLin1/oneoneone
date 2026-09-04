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

  return (
    // Below lg this is the original single centered column (badge, portrait,
    // title, byline, body, source — in that order). From lg up, everything
    // that's *about* the work — badge, portrait, title, byline, source —
    // breaks out into a sticky sidebar, leaving the right side as nothing
    // but the reading itself. Stretching the text column to fill the extra
    // width would just make lines too long to read comfortably, so the
    // width goes to that info panel instead.
    <article className="mx-auto max-w-5xl lg:flex lg:items-start lg:gap-16">
      <aside className="mb-10 flex flex-col items-center text-center lg:sticky lg:top-6 lg:mb-0 lg:w-64 lg:shrink-0 lg:items-start lg:text-left">
        <span
          className={`inline-block px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${accent.bg} ${accent.text}`}
        >
          {CATEGORY_LABEL[work.category]} · ~{work.reading_minutes} min
        </span>

        <AuthorMark
          portraitUrl={work.author_portrait_url}
          authorName={work.author}
          accentBg={accent.bg}
          accentText={accent.text}
          className="mt-6 h-40 w-40 overflow-hidden border-2 border-ink sm:h-48 sm:w-48 lg:h-36 lg:w-36"
          initialSizeClassName="text-6xl sm:text-7xl"
        />

        <h1 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl lg:text-2xl">{work.title}</h1>
        <p className="mt-4 text-sm text-ink-soft">
          {work.author}
          {work.year ? ` · ${work.year}` : ""}
        </p>
        {work.author_note && (
          <p className="mt-2 font-serif text-sm italic text-ink-soft">{work.author_note}</p>
        )}

        <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-soft">
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

      <div className={`${isPoem ? "max-w-xl" : "max-w-2xl"} mx-auto lg:mx-0 lg:min-w-0 lg:flex-1`}>
        {isPoem ? (
          <p className="whitespace-pre-line text-center font-serif text-lg leading-loose lg:text-left">
            {work.text_content}
          </p>
        ) : (
          <div className="prose prose-lg prose-reading mx-auto font-serif lg:mx-0">
            {work.text_content?.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
