import { notFound, redirect } from "next/navigation";
import { dateForDay, globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import { readWork } from "@/lib/works";
import { ReadingFlow } from "@/components/ReadingFlow";
import type { WorkCategory } from "@/lib/types";

const ORDER: WorkCategory[] = ["poem", "essay", "story"];

function isWorkCategory(value: string): value is WorkCategory {
  return (ORDER as string[]).includes(value);
}

// Which days are past depends on "today" — never freeze it at build time.
export const dynamic = "force-dynamic";

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

  const category = categoryParam;
  const work = readWork(category, dateForDay(day));
  if (!work) notFound();

  return (
    <ReadingFlow
      work={work}
      category={category}
      dayNumber={day}
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
