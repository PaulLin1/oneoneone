"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FetchCandidatesResult } from "@/lib/fetchCandidates";

type FetchApiResponse = FetchCandidatesResult & { deeperSearchStarted: boolean; deeperSearchError?: string };

/**
 * Tries the fast, free, non-agent path first (see app/api/admin/
 * fetch-candidates) — if the pool's exhausted, that route automatically
 * falls back to starting content-pipeline.yml's real web-search discovery,
 * which isn't instant, so this can't just show a result the way the fast
 * path does; it has to say "started, check back."
 */
export function FetchCandidatesButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        "Fetch up to 7 new candidates of each category (poem/essay/story)? If the local pool is empty, this starts a deeper web search in the background instead."
      )
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fetch-candidates", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      const { staged, failed, deeperSearchStarted, deeperSearchError } = body as FetchApiResponse;
      if (staged.length > 0) {
        setMessage(
          `Staged ${staged.length} new candidate${staged.length === 1 ? "" : "s"}.${failed.length > 0 ? ` (${failed.length} failed.)` : ""}`
        );
      } else if (deeperSearchStarted) {
        setMessage("Local pool was empty — started a deeper search on GitHub Actions. Check back in a few minutes.");
      } else {
        setMessage(`Local pool was empty, and the deeper search couldn't start: ${deeperSearchError}`);
      }
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
