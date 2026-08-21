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

async function fetchTodaysSelection(): Promise<DailySelection> {
  const res = await fetch("/api/daily-selection");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
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
      setLoading(false);
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
    error,
    dayNumber: selection?.day ?? null,
    todaySelection: selection,
    getWork: (category: WorkCategory): Work | null => randomized[category] ?? selection?.[category] ?? null,
    isRandomized: (category: WorkCategory): boolean => Boolean(randomized[category]),
    randomizeCategory,
    resetRandomized,
  };
}
