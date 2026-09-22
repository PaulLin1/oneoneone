import Link from "next/link";
import { DayStrip } from "@/components/DayStrip";
import type { WorkCategory } from "@/lib/types";

/**
 * The slim running head above a reading page: back link on the left, the
 * day strip (nav between the day's three) on the right. Everything else
 * about the current work — edition number, category, read time — lives in
 * ReadingView's sidebar instead, alongside the rest of the work's info.
 */
export function ReadingHead({
  backHref,
  backLabel,
  category,
  progressHrefs,
}: {
  backHref: string;
  backLabel: string;
  category: WorkCategory;
  progressHrefs: Record<WorkCategory, string>;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 py-4">
      {/* -my-3.5/py-3.5: same invisible tap-target growth as Masthead's CHIP
          — the negative margin cancels the added padding, so this still
          sits exactly where a plain text-sm link would, just with a real
          ~44px hit area instead of one sized to the text's line-height. */}
      <Link
        href={backHref}
        className="-my-3.5 py-3.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        ← {backLabel}
      </Link>
      <DayStrip current={category} hrefs={progressHrefs} />
    </div>
  );
}
