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
    <article className={isPoem ? "mx-auto max-w-xl" : "mx-auto max-w-2xl"}>
      <header className="mb-16 text-center">
        <span
          className={`inline-block border-2 border-ink px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${accent.bg} ${accent.text}`}
        >
          {CATEGORY_LABEL[work.category]} · ~{work.reading_minutes} min
        </span>

        <AuthorMark
          portraitUrl={work.author_portrait_url}
          authorName={work.author}
          accentBg={accent.bg}
          accentText={accent.text}
          className="mx-auto mt-6 h-40 w-40 border-2 border-ink sm:h-48 sm:w-48"
          initialSizeClassName="text-6xl sm:text-7xl"
        />

        <h1 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl">{work.title}</h1>
        <p className="mt-4 text-sm text-ink-soft">
          {work.author}
          {work.year ? ` · ${work.year}` : ""}
        </p>
        {work.author_note && (
          <p className="mt-2 font-serif text-sm italic text-ink-soft">{work.author_note}</p>
        )}
      </header>

      {isPoem ? (
        <p className="whitespace-pre-line text-center font-serif text-lg leading-loose">
          {work.text_content}
        </p>
      ) : (
        <div className="prose prose-lg prose-reading mx-auto font-serif">
          {work.text_content?.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}

      <footer className="mt-16 border-t border-black/15 pt-8 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-soft">
        <p>
          Source:{" "}
          <a
            href={work.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-black/20 underline-offset-4 transition-colors hover:text-ink"
          >
            {work.source_name}
          </a>
          {work.public_domain ? " · Public domain" : ""}
        </p>
      </footer>
    </article>
  );
}
