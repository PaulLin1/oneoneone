"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocalState } from "@/lib/local-state/useLocalState";
import { ReadingFlow } from "@/components/ReadingFlow";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];

function isWorkCategory(value: string): value is WorkCategory {
  return (ORDER as string[]).includes(value);
}

export default function ReadPage() {
  const params = useParams<{ category: string }>();
  const { loading, dayNumber, todaySelection, getWork, isRandomized, randomizeCategory, resetRandomized } =
    useLocalState();

  const categoryParam = params.category;

  if (loading && !todaySelection) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 sm:px-10">
        <p className="text-sm text-ink-soft">Loading…</p>
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

  const currentIndex = ORDER.indexOf(category);
  const nextCategory = ORDER[currentIndex + 1];

  return (
    <ReadingFlow
      work={work}
      category={category}
      backHref="/"
      backLabel={`No. ${dayNumber !== null ? dayNumber : "···"}`}
      progressHrefs={{ poem: "/read/poem", essay: "/read/essay", story: "/read/story" }}
      nextHref={nextCategory ? `/read/${nextCategory}` : "/"}
      nextLabel={nextCategory ? "Next" : "Done"}
      shuffle={{
        isRandomized: isRandomized(category),
        onShuffle: () => randomizeCategory(category),
        onReset: () => resetRandomized(category),
      }}
    />
  );
}
