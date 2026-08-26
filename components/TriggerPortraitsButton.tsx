"use client";

import { useState } from "react";

/**
 * Starts the author-portraits.yml GitHub Action — see app/api/admin/
 * trigger-author-portraits for why this dispatches the workflow instead of
 * running the portrait pipeline directly (it needs a real filesystem).
 * There's no run id to poll from a workflow_dispatch call, so this can only
 * confirm the request was accepted, not watch it finish — check the
 * Actions tab for progress.
 */
export function TriggerPortraitsButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        "Start the author-portraits workflow now? It runs on GitHub Actions and can take several minutes — check the Actions tab for progress."
      )
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/trigger-author-portraits", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessage("Started — check the Actions tab.");
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
        className="border border-ink px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {pending ? "Starting…" : "Fetch portraits"}
      </button>
      {message && <p className="text-xs text-ink-soft">{message}</p>}
    </div>
  );
}
