"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FetchCandidatesResult } from "@/lib/fetchCandidates";

/**
 * Same underlying work as `npm run fetch-candidates`, just triggered from
 * /account instead of a terminal — see app/api/admin/fetch-candidates.
 * Confirms first since it's a real action (network fetches, new DB rows),
 * not a free page navigation.
 */
export function FetchCandidatesButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Fetch up to 7 new candidates of each category (poem/essay/story) from the source pool? This can take a minute or two.")) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fetch-candidates", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      const { staged, failed } = body as FetchCandidatesResult;
      setMessage(
        staged.length > 0
          ? `Staged ${staged.length} new candidate${staged.length === 1 ? "" : "s"}.${failed.length > 0 ? ` (${failed.length} failed.)` : ""}`
          : "Nothing new to fetch."
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="bg-yellow px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Fetching…" : "Fetch new candidates"}
      </button>
      {message && <p className="text-xs text-ink-soft">{message}</p>}
    </div>
  );
}
