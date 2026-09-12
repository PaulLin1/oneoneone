import { notFound, redirect } from "next/navigation";
import { getDailySelection } from "@/lib/dailyPicks";
import { dateForDay, globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import { ReadingFlow } from "@/components/ReadingFlow";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];

function isWorkCategory(value: string): value is WorkCategory {
  return (ORDER as string[]).includes(value);
}

export default async function ArchiveReadPage({
  params,
}: {
  params: Promise<{ day: string; category: string }>;
}) {
  const { day: dayParam, category: categoryParam } = await params;
  const day = Number(dayParam);
  const currentDay = globalDayNumber(todayIso());

  if (!Number.isInteger(day) || day < 1 || day > currentDay) notFound();
  if (!isWorkCategory(categoryParam)) notFound();
  // Today isn't archived yet — send this into today's own reading flow.
  if (day === currentDay) redirect(`/read/${categoryParam}`);

  const date = dateForDay(day);
  const selection = await getDailySelection(date);
  if (!selection) notFound();

  const category = categoryParam;
  const work = selection[category];

  return (
    <ReadingFlow
      work={work}
      category={category}
      readDate={todayIso()}
      source="archive"
      sourceDate={date}
      backHref="/archive"
      backLabel="Archive"
      progressHrefs={{
        poem: `/archive/${day}/poem`,
        essay: `/archive/${day}/essay`,
        story: `/archive/${day}/story`,
      }}
    />
  );
}
