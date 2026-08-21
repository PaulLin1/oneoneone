import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { selectDailyWorks } from "@/lib/selection/algorithm";
import { dateForDay, globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import { ReadingFlow } from "@/components/ReadingFlow";
import type { Work, WorkCategory } from "@/lib/types";

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

  const sql = getDb();
  const works = (await sql`select * from works_feed where is_active = true`) as unknown as Work[];
  const date = dateForDay(day);
  const selection = selectDailyWorks({ date, works });

  const category = categoryParam;
  const work = selection[category];

  const currentIndex = ORDER.indexOf(category);
  const nextCategory = ORDER[currentIndex + 1];

  return (
    <ReadingFlow
      work={work}
      category={category}
      backHref="/archive"
      backLabel="Archive"
      progressHrefs={{
        poem: `/archive/${day}/poem`,
        essay: `/archive/${day}/essay`,
        story: `/archive/${day}/story`,
      }}
      nextHref={nextCategory ? `/archive/${day}/${nextCategory}` : "/archive"}
      nextLabel={nextCategory ? "Next" : "Done"}
    />
  );
}
