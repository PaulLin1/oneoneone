import { getDailySelection } from "@/lib/dailyPicks";
import { todayIso, formatDisplayDate } from "@/lib/dateMath";
import { FrontPageTile } from "@/components/FrontPageTile";

export default async function Home() {
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

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex shrink-0 items-baseline justify-between gap-4 border-b border-ink/10 px-6 py-7 sm:px-10">
        <h1 className="text-4xl tracking-tight sm:text-5xl">No. {selection.day}</h1>
        <p className="text-sm text-ink-soft">{formatDisplayDate(selection.date)}</p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-ink/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <FrontPageTile category="poem" work={selection.poem} />
        <FrontPageTile category="essay" work={selection.essay} />
        <FrontPageTile category="story" work={selection.story} />
      </div>
    </main>
  );
}
