import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ReadingView } from "@/components/ReadingView";
import { globalDayNumber } from "@/lib/epoch";
import { todayIso } from "@/lib/dateMath";
import type { Work } from "@/lib/types";

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day: dayParam } = await searchParams;
  const sql = getDb();
  const rows = (await sql`
    select * from works_feed where id = ${id} and is_active = true limit 1
  `) as unknown as Work[];

  const work = rows[0];
  if (!work) notFound();

  const currentDay = globalDayNumber(todayIso());

  // If we arrived from an archive day, "back" should return there, not to today.
  const fromDay = dayParam ? Number(dayParam) : NaN;
  const isArchiveDay = Number.isInteger(fromDay) && fromDay >= 1 && fromDay < currentDay;

  const backHref = isArchiveDay ? `/archive/${fromDay}` : "/";
  const backLabel = isArchiveDay ? fromDay : currentDay;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <div className="shrink-0 py-6">
        <Link href={backHref} className="text-sm text-ink-soft transition-colors hover:text-ink">
          ← No. {backLabel}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto border-t-2 border-ink py-10">
        <ReadingView work={work} readDate={todayIso()} source="random" />
        <p className="mt-10 text-center text-xs text-ink-soft">
          Related reading — not one of that day&apos;s three.
        </p>
      </div>
    </main>
  );
}
