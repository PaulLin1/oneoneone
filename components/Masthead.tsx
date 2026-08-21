"use client";

import Link from "next/link";
import { useLocalState } from "@/lib/local-state/useLocalState";
import { formatDisplayDate } from "@/lib/dateMath";

export function Masthead() {
  const { dayNumber, todaySelection } = useLocalState();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink bg-yellow px-6 sm:px-10">
      <Link href="/" className="-my-2 py-2 text-base tracking-tight">
        {/* One color per "one" — poem, essay, story, in that order, matching
            the app icon and every other category-color mapping in the app. */}
        <span className="text-blue">one</span>
        <span className="text-pink">one</span>
        <span className="text-purple">one</span>
      </Link>
      <div className="flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.15em] text-black">
        <span>
          No. {dayNumber !== null ? dayNumber : "···"}
          {todaySelection && (
            <span className="hidden sm:inline"> · {formatDisplayDate(todaySelection.date)}</span>
          )}
        </span>
        <Link
          href="/archive"
          className="-my-2 py-2 underline decoration-black/40 underline-offset-4 transition-colors hover:decoration-black"
        >
          Archive
        </Link>
        <Link
          href="/about"
          className="-my-2 py-2 underline decoration-black/40 underline-offset-4 transition-colors hover:decoration-black"
        >
          About
        </Link>
      </div>
    </header>
  );
}
