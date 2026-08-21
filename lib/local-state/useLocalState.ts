"use client";

import { useCallback, useEffect, useState } from "react";
import type { DailySelection, Work, WorkCategory } from "@/lib/types";
import { parseLocalState, STORAGE_KEY, type LocalState } from "./schema";
import { todayIso } from "@/lib/dateMath";

function readFromStorage(): LocalState | null {
  if (typeof window === "undefined") return null;
  return parseLocalState(window.localStorage.getItem(STORAGE_KEY));
}

function writeToStorage(state: LocalState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Generous, not aggressive: a serverless Postgres backend (Neon) suspends
// after idle and the next query pays a "cold start" of a few seconds to
// wake it back up — that's normal and shouldn't be mistaken for a hang.
// This timeout exists to catch a *genuinely* stuck request, not to cut off
// a slow-but-working one.
const FETCH_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "That took too long — the database may still be waking up. Try again in a moment."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Masthead and whichever page is mounted each call useLocalState()
// independently — without this, a cold visit fires two concurrent fetches
// at the same sleeping database instead of one. Later callers just await
// whichever fetch is already in flight.
let inFlightSelection: Promise<DailySelection> | null = null;

async function fetchTodaysSelection(): Promise<DailySelection> {
  if (inFlightSelection) return inFlightSelection;

  inFlightSelection = (async () => {
    const res = await fetchWithTimeout("/api/daily-selection");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Request failed with status ${res.status}`);
    }
    return res.json();
  })();

  try {
    return await inFlightSelection;
  } finally {
    inFlightSelection = null;
  }
}

async function fetchRandomWork(category: WorkCategory, excludeId: string): Promise<Work> {
  const res = await fetch(`/api/randomize?category=${category}&exclude=${excludeId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function useLocalState() {
  const [selection, setSelection] = useState<DailySelection | null>(null);
  const [randomized, setRandomized] = useState<Partial<Record<WorkCategory, Work>>>({});
  const [loading, setLoading] = useState(true);
  // Flips true if loading takes a while, so the UI can say "still working"
  // instead of leaving a bare spinner that's indistinguishable from stuck.
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    const today = todayIso();
    const cached = readFromStorage();

    if (cached?.today && cached.today.date === today) {
      setSelection(cached.today);
      setRandomized(cached.randomized ?? {});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsSlow(false);
    const slowTimer = setTimeout(() => setIsSlow(true), 4000);
    try {
      const fresh = await fetchTodaysSelection();
      // A new day always starts with no shuffles — randomized never carries
      // across the date rollover, same as `today` itself getting replaced.
      writeToStorage({ today: fresh, randomized: {} });
      setSelection(fresh);
      setRandomized({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load today's readings.");
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsSlow(false);
    }
  }, []);

  useEffect(() => {
    // Reading localStorage and fetching today's selection can only happen
    // client-side post-mount; this is the canonical use case for an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
  }, [initialize]);

  const randomizeCategory = useCallback(
    async (category: WorkCategory) => {
      if (!selection) return;
      const excludeId = (randomized[category] ?? selection[category]).id;
      const pick = await fetchRandomWork(category, excludeId);
      setRandomized((prev) => {
        const next = { ...prev, [category]: pick };
        writeToStorage({ today: selection, randomized: next });
        return next;
      });
    },
    [selection, randomized]
  );

  const resetRandomized = useCallback(
    (category: WorkCategory) => {
      if (!selection) return;
      setRandomized((prev) => {
        const next = { ...prev };
        delete next[category];
        writeToStorage({ today: selection, randomized: next });
        return next;
      });
    },
    [selection]
  );

  return {
    loading,
    isSlow,
    error,
    retry: initialize,
    dayNumber: selection?.day ?? null,
    todaySelection: selection,
    getWork: (category: WorkCategory): Work | null => randomized[category] ?? selection?.[category] ?? null,
    isRandomized: (category: WorkCategory): boolean => Boolean(randomized[category]),
    randomizeCategory,
    resetRandomized,
  };
}
