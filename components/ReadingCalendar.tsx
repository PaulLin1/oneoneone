"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { buildReadingCalendar, type ReadingHistoryEntry } from "@/lib/readingCalendar";
import { CATEGORY_ACCENT } from "@/lib/categoryColor";
import { formatDisplayDate } from "@/lib/dateMath";
import type { WorkCategory } from "@/lib/types";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];
const CATEGORY_LABEL: Record<WorkCategory, string> = {
  poem: "Poem",
  essay: "Essay",
  story: "Story",
};

// Row height is the one fixed dimension — column width is fluid (each week
// is an equal fraction of whatever space is available), so the calendar
// always fits its container at any screen width instead of overflowing
// into a horizontal scrollbar.
const ROW = 18; // px
const GAP = 3; // px — between cells and between week columns
const MONTH_ROW = 16; // px — height of the month-label row above the grid

// Only Mon/Wed/Fri get a label — 0=Sun..6=Sat — same reason GitHub's own
// calendar skips alternating rows: seven labels crammed against 18px-tall
// cells just collide into noise.
const WEEKDAY_LABEL: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" };

function sourceLabel(entry: ReadingHistoryEntry): string {
  switch (entry.source) {
    case "daily":
      return `Daily · ${formatDisplayDate(entry.date)}`;
    case "random":
      return "Shuffled";
    case "archive":
      return entry.sourceDate ? `From ${formatDisplayDate(entry.sourceDate)}` : "From another day";
    case "external":
      return "Outside read";
  }
}

async function addExternalEntry(payload: {
  category: WorkCategory;
  date: string;
  externalTitle: string;
  externalAuthor?: string;
}): Promise<string> {
  const res = await fetch("/api/reading-history/entry", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? "Couldn't save that.");
  }
  return body.id as string;
}

async function deleteEntry(id: string) {
  const res = await fetch(`/api/reading-history/entry?id=${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Couldn't clear that.");
  }
}

/**
 * Just the calendar + the selected day's detail panel — /account (via
 * ReadingHistorySection, which owns the `rows` state so it can also drive
 * the Overview stats from the same live data) is what wires this up. A
 * controlled component: `rows` is never copied into local state here, so
 * an add/clear immediately shows up wherever else `rows` is used.
 */
export function ReadingCalendar({
  today,
  weeks,
  rows,
  onRowsChange,
}: {
  today: string;
  weeks: number;
  rows: ReadingHistoryEntry[];
  onRowsChange: Dispatch<SetStateAction<ReadingHistoryEntry[]>>;
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  // An entry id while clearing it, or `${category}::add` while saving a new
  // outside read — a slot can hold several entries now, so "which thing is
  // this button doing something to" needs more than just category+date.
  const [pending, setPending] = useState<string | null>(null);
  const [openExternalFor, setOpenExternalFor] = useState<WorkCategory | null>(null);
  const [extTitle, setExtTitle] = useState("");
  const [extAuthor, setExtAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const grid = useMemo(() => buildReadingCalendar(today, weeks, rows), [today, weeks, rows]);
  const selectedEntries = useMemo(() => {
    const forDay: Record<WorkCategory, ReadingHistoryEntry[]> = { poem: [], essay: [], story: [] };
    for (const row of rows) {
      if (row.date === selectedDate) forDay[row.category].push(row);
    }
    return forDay;
  }, [rows, selectedDate]);

  function selectDate(date: string) {
    setSelectedDate(date);
    setOpenExternalFor(null);
    setError(null);
  }

  async function handleSaveExternal(category: WorkCategory) {
    const title = extTitle.trim();
    if (!title) {
      setError("A title is required.");
      return;
    }
    const addKey = `${category}::add`;
    setPending(addKey);
    setError(null);
    try {
      const author = extAuthor.trim() || undefined;
      const id = await addExternalEntry({ category, date: selectedDate, externalTitle: title, externalAuthor: author });
      onRowsChange((prev) => [
        ...prev,
        {
          id,
          date: selectedDate,
          category,
          title,
          author: author ?? null,
          workId: null,
          source: "external",
          sourceDate: null,
        },
      ]);
      setOpenExternalFor(null);
      setExtTitle("");
      setExtAuthor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function handleClear(id: string) {
    setPending(id);
    setError(null);
    try {
      await deleteEntry(id);
      onRowsChange((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    // Stacked on narrow screens; from lg up, the calendar sits beside the
    // detail panel instead of above it. Neither side is stretched to match
    // the other — the calendar is whatever height its content needs, and
    // the detail panel is capped (see max-h below) with its own scroll for
    // an unusually busy day, rather than growing to fill leftover space
    // that isn't there and leaving a gap under the (shorter) calendar.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3 lg:min-w-0 lg:flex-1">
        <div className="flex shrink-0" style={{ gap: 6 }}>
          <div className="flex shrink-0 flex-col" style={{ marginTop: MONTH_ROW + 4, gap: GAP }}>
            {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
              <div
                key={weekday}
                style={{ height: ROW }}
                className="flex items-center whitespace-nowrap text-[9px] uppercase tracking-[0.05em] text-ink-soft"
              >
                {WEEKDAY_LABEL[weekday] ?? ""}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative mb-1" style={{ height: MONTH_ROW }}>
              {grid.monthLabels.map((m) => (
                <span
                  key={`${m.column}-${m.label}`}
                  className="absolute top-0 text-[10px] uppercase tracking-[0.1em] text-ink-soft"
                  style={{ left: `${(m.column / grid.weeks.length) * 100}%` }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${grid.weeks.length}, minmax(0, 1fr))`, gap: GAP }}
            >
              {grid.weeks.map((column, i) => {
                // Columns are packed edge-to-edge with no room to scroll, so a
                // centered tooltip on the first/last couple of columns would
                // spill past the page edge — pin it to whichever side of the
                // cell stays on-screen instead.
                const edge = i <= 1 ? "left-0" : i >= grid.weeks.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
                return (
                  <div key={i} className="flex min-w-0 flex-col" style={{ gap: GAP }}>
                    {column.map((day) =>
                      day.future ? (
                        <div key={day.date} style={{ height: ROW }} />
                      ) : (
                        <div key={day.date} className="group relative">
                          <button
                            type="button"
                            onClick={() => selectDate(day.date)}
                            aria-label={formatDisplayDate(day.date)}
                            className={`flex w-full overflow-hidden border transition-colors ${
                              day.date === selectedDate ? "border-ink" : "border-black/10 hover:border-black/30"
                            }`}
                            style={{ height: ROW, gap: 1 }}
                          >
                            {CATEGORIES.map((category) => {
                              const read = day.entries[category].length > 0;
                              return (
                                <span
                                  key={category}
                                  aria-hidden="true"
                                  className={`flex-1 ${read ? CATEGORY_ACCENT[category].bg : "bg-black/10"}`}
                                />
                              );
                            })}
                          </button>
                          {/* Below the cell, not above — the top rows have no
                              room above them for a tooltip to open into. */}
                          <div
                            className={`pointer-events-none absolute top-full z-20 mt-1.5 hidden whitespace-nowrap bg-ink px-1.5 py-1 text-[10px] font-semibold text-paper group-hover:block ${edge}`}
                          >
                            {formatDisplayDate(day.date)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          {CATEGORIES.map((category) => (
            <span key={category} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 ${CATEGORY_ACCENT[category].bg}`} aria-hidden="true" />
              {CATEGORY_LABEL[category]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 bg-black/10" aria-hidden="true" />
            Not logged
          </span>
        </div>
      </div>

      <div className="flex flex-col border-2 border-ink lg:w-96 lg:shrink-0">
        <div className="shrink-0 bg-ink px-4 py-2 text-paper">
          <p className="text-xs font-semibold uppercase tracking-[0.15em]">{formatDisplayDate(selectedDate)}</p>
        </div>

        <div className="h-48 divide-y divide-black/10 overflow-y-auto px-4">
          {CATEGORIES.map((category) => {
            const entries = selectedEntries[category];
            const accent = CATEGORY_ACCENT[category];
            const isOpen = openExternalFor === category;
            const isAdding = pending === `${category}::add`;

            return (
              <div key={category} className="py-2">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-14 shrink-0 whitespace-nowrap px-1.5 py-0.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${accent.bg} ${accent.text}`}
                  >
                    {CATEGORY_LABEL[category]}
                  </span>

                  <div className="min-w-0 flex-1">
                    {entries.length === 0 ? (
                      <p className="text-sm text-ink-soft">Not logged</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {entries.map((entry) => (
                          <li key={entry.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {entry.workId ? (
                                <Link
                                  href={`/work/${entry.workId}`}
                                  className="block truncate font-serif text-sm underline decoration-black/20 underline-offset-4 hover:decoration-black"
                                >
                                  {entry.title}
                                </Link>
                              ) : (
                                <p className="truncate font-serif text-sm">{entry.title}</p>
                              )}
                              <p className="truncate text-xs text-ink-soft">
                                {entry.author ?? "Unknown"} · {sourceLabel(entry)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={pending === entry.id}
                              onClick={() => handleClear(entry.id)}
                              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft underline decoration-black/20 underline-offset-4 transition-colors hover:text-pink disabled:opacity-50"
                            >
                              Clear
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => {
                        setOpenExternalFor(isOpen ? null : category);
                        setExtTitle("");
                        setExtAuthor("");
                        setError(null);
                      }}
                      className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft underline decoration-black/20 underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
                    >
                      + Outside read
                    </button>

                    {isOpen && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={extTitle}
                          onChange={(e) => setExtTitle(e.target.value)}
                          placeholder="Title"
                          className="min-w-0 flex-1 border-2 border-black/20 bg-paper px-2.5 py-1.5 font-serif text-sm focus:border-ink focus:outline-none"
                        />
                        <input
                          value={extAuthor}
                          onChange={(e) => setExtAuthor(e.target.value)}
                          placeholder="Author (optional)"
                          className="min-w-0 flex-1 border-2 border-black/20 bg-paper px-2.5 py-1.5 font-serif text-sm focus:border-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => handleSaveExternal(category)}
                          className="border-2 border-ink bg-yellow px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {isAdding ? "Saving…" : "Save"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="shrink-0 text-sm text-pink">{error}</p>}
    </div>
  );
}
