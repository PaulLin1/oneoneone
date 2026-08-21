"use client";

import { useLocalState } from "@/lib/local-state/useLocalState";
import { formatDisplayDate } from "@/lib/dateMath";
import { CategoryColumn } from "@/components/CategoryColumn";
import { ShareButton } from "@/components/ShareButton";

export default function Home() {
  const { loading, error, dayNumber, todaySelection } = useLocalState();

  if (loading && !todaySelection) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 sm:px-10">
        <p className="text-sm text-ink-soft">Loading today&apos;s three…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 text-center sm:px-10">
        <p className="text-sm text-ink-soft">
          Couldn&apos;t load today&apos;s readings: {error}
        </p>
      </main>
    );
  }

  if (!todaySelection) return null;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-10">
      <div className="shrink-0">
        <h1 className="text-2xl tracking-tight sm:text-3xl">
          No. {dayNumber !== null ? dayNumber : "···"}
        </h1>
        {todaySelection && (
          <p className="mt-1 text-sm text-ink-soft">{formatDisplayDate(todaySelection.date)}</p>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="flex flex-wrap items-stretch justify-center gap-5 sm:gap-6 lg:gap-8">
          <CategoryColumn category="poem" work={todaySelection.poem} />
          <CategoryColumn category="essay" work={todaySelection.essay} />
          <CategoryColumn category="story" work={todaySelection.story} />
        </div>
      </div>

      <div className="flex shrink-0 justify-center pb-2">
        <ShareButton selection={todaySelection} />
      </div>
    </main>
  );
}
