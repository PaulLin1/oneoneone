import { notFound } from "next/navigation";
import { getDailySelection } from "@/lib/dailyPicks";
import { todayIso } from "@/lib/dateMath";
import { ReadingFlow } from "@/components/ReadingFlow";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];

function isWorkCategory(value: string): value is WorkCategory {
  return (ORDER as string[]).includes(value);
}

export default async function ReadPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryParam } = await params;
  if (!isWorkCategory(categoryParam)) notFound();

  const selection = await getDailySelection(todayIso());
  if (!selection) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center sm:px-10">
        <p className="text-sm text-ink-soft">
          Today&apos;s reading is still being put together — check back shortly.
        </p>
      </main>
    );
  }

  const category = categoryParam;
  const work = selection[category];

  return (
    <ReadingFlow
      work={work}
      category={category}
      readDate={todayIso()}
      source="daily"
      dayNumber={selection.day}
      backHref="/"
      backLabel="Today"
      progressHrefs={{ poem: "/read/poem", essay: "/read/essay", story: "/read/story" }}
    />
  );
}
