import { WorkMiniList } from "@/components/WorkMiniList";
import type { Work } from "@/lib/types";

/** The /account "Recommended for you" section — same dot+label header as Overview/Reading history. */
export function RecommendedWorks({ works }: { works: Work[] }) {
  if (works.length === 0) return null;

  return (
    <section className="shrink-0">
      <div className="flex items-center gap-2 pb-3">
        <span className="h-2.5 w-2.5 shrink-0 bg-link" aria-hidden="true" />
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
          Recommended for you
        </h2>
      </div>
      <WorkMiniList works={works} columns="sm:grid-cols-2" />
    </section>
  );
}
