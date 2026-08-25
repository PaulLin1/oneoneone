"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocalState } from "@/lib/local-state/useLocalState";
import { ReadingFlow } from "@/components/ReadingFlow";
import { todayIso } from "@/lib/dateMath";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];

function isWorkCategory(value: string): value is WorkCategory {
  return (ORDER as string[]).includes(value);
}

export default function ReadPage() {
  const params = useParams<{ category: string }>();
  const {
    loading,
    isSlow,
    error,
    retry,
    dayNumber,
    todaySelection,
    getWork,
    isRandomized,
    randomizeCategory,
    resetRandomized,
  } = useLocalState();

  const categoryParam = params.category;

  if (loading && !todaySelection) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 sm:px-10">
        <div className="flex gap-2" aria-hidden="true">
          <span className="h-3 w-3 animate-pulse bg-blue [animation-delay:0ms]" />
          <span className="h-3 w-3 animate-pulse bg-pink [animation-delay:150ms]" />
          <span className="h-3 w-3 animate-pulse bg-purple [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-ink-soft">
          {isSlow ? "Still loading — the database is waking up, hang tight…" : "Loading…"}
        </p>
      </main>
    );
  }

  if (error && !todaySelection) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center sm:px-10">
        <p className="text-sm text-ink-soft">Couldn&apos;t load today&apos;s readings: {error}</p>
        <button
          type="button"
          onClick={retry}
          className="text-sm text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:text-ink-soft"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!todaySelection || !isWorkCategory(categoryParam)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center sm:px-10">
        <p className="text-sm text-ink-soft">No reading found for today.</p>
        <Link href="/" className="text-sm text-ink underline decoration-black/20 underline-offset-4">
          Back to today
        </Link>
      </main>
    );
  }

  const category = categoryParam;
  const work = getWork(category);
  if (!work) return null;

  return (
    <ReadingFlow
      work={work}
      category={category}
      readDate={todayIso()}
      source={isRandomized(category) ? "random" : "daily"}
      backHref="/"
      backLabel={`No. ${dayNumber !== null ? dayNumber : "···"}`}
      progressHrefs={{ poem: "/read/poem", essay: "/read/essay", story: "/read/story" }}
      shuffle={{
        isRandomized: isRandomized(category),
        onShuffle: () => randomizeCategory(category),
        onReset: () => resetRandomized(category),
      }}
    />
  );
}
