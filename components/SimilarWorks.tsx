import { WorkMiniList } from "@/components/WorkMiniList";
import type { Work } from "@/lib/types";

/** A "you might also like" strip below a reading — nothing rendered if there's nothing worth suggesting. */
export function SimilarWorks({ works }: { works: Work[] }) {
  if (works.length === 0) return null;

  return (
    <div className="mx-auto mt-16 max-w-[46rem] border-t border-ink/10 pt-10">
      <p className="text-xs text-ink-soft">You might also like</p>
      <div className="mt-5">
        <WorkMiniList works={works} />
      </div>
    </div>
  );
}
