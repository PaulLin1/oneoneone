/**
 * Keeps every category filled AHEAD_DAYS days ahead — the one command the
 * daily job runs.
 *
 *   npm run stock -- [--days=14] [--max-cost=2] [--from=YYYY-MM-DD]
 *
 * --from starts earlier than today, to backfill past days (the archive).
 *
 * For each day from today to today+days that's missing a poem, essay or
 * story, it runs scripts/find-work.ts for that day (one child process per
 * work, oldest day first). The site shows each work on its own date, so the
 * buffer means a broken source, API outage or failed run has two weeks to be
 * noticed before readers see anything — and then only a repeat of the last
 * day, never an empty page (lib/works.ts).
 *
 * Cost stays bounded three ways: each find-work run makes at most a few
 * Claude calls, a category that fails is skipped for the rest of this run
 * (its later days would most likely fail the same way), and no new run starts
 * once --max-cost is spent. A normal day adds three works, a few cents.
 *
 * Exits non-zero when any category is stocked fewer than MIN_BUFFER_DAYS
 * ahead, so a scheduled job fails — and notifies — long before the site runs dry.
 */

import { spawnSync } from "node:child_process";
import { todayIso } from "@/lib/dateMath";
import type { WorkCategory } from "@/lib/types";
import { CATEGORIES, scheduledDates } from "@/lib/works";

const AHEAD_DAYS = 14;
const MIN_BUFFER_DAYS = 7;
const MAX_COST_USD = 2;
/** A find-work run that takes longer than this is stuck; it's killed and counted as a failure. */
const RUN_TIMEOUT_MS = 10 * 60_000;

const log = (msg: string) => console.error(msg);

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return todayIso(d);
}

/** How many consecutive days from today on already have a work. */
function bufferDays(category: WorkCategory, today: string): number {
  const taken = new Set(scheduledDates(category));
  let days = 0;
  while (taken.has(addDays(today, days))) days++;
  return days;
}

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    })
  );
  const days = Number(args.days ?? AHEAD_DAYS);
  const maxCost = Number(args["max-cost"] ?? MAX_COST_USD);
  const from = args.from ?? todayIso();
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(from) && addDays(from, 0) === from && from <= todayIso();
  if (!(days >= 0) || !(maxCost >= 0) || !validFrom) {
    log("usage: npm run stock -- [--days=14] [--max-cost=2] [--from=YYYY-MM-DD, not after today]");
    process.exit(1);
  }
  return { days, maxCost, from };
}

function main() {
  const { days, maxCost, from } = parseArgs();
  const today = todayIso();
  const last = addDays(today, days);

  const todo: { category: WorkCategory; date: string }[] = [];
  for (let date = from; date <= last; date = addDays(date, 1)) {
    for (const category of CATEGORIES) {
      if (!scheduledDates(category).includes(date)) todo.push({ category, date });
    }
  }
  log(`Stocking ${from} → ${last}: ${todo.length} work${todo.length === 1 ? "" : "s"} to find.`);

  let spent = 0;
  const failed = new Set<WorkCategory>();
  const results: string[] = [];

  for (const { category, date } of todo) {
    if (failed.has(category)) continue;
    if (spent >= maxCost) {
      results.push(`stopped: spent $${spent.toFixed(2)} of the $${maxCost} cap`);
      break;
    }

    log(`\n━━ ${category} for ${date} ━━`);
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/find-work.ts", `--category=${category}`, `--date=${date}`],
      { encoding: "utf8", timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
    );
    process.stderr.write(run.stderr ?? "");
    const cost = Number(run.stderr?.match(/≈ \$([\d.]+)/)?.[1] ?? 0);
    spent += cost;

    if (run.status === 0) {
      const title = (() => {
        try {
          const { work } = JSON.parse(run.stdout) as { work: { title: string; author: string } };
          return `${work.title} — ${work.author}`;
        } catch {
          return "saved";
        }
      })();
      results.push(`✓ ${date} ${category}: ${title} ($${cost.toFixed(3)})`);
    } else {
      failed.add(category);
      const why = run.error ? run.error.message : `exit ${run.status ?? run.signal}`;
      results.push(`✗ ${date} ${category}: failed (${why}) — skipping ${category}'s later days this run`);
    }
  }

  const buffers = CATEGORIES.map((category) => ({ category, days: bufferDays(category, today) }));
  log(`\n━━ summary ━━\n${results.join("\n") || "nothing to do"}`);
  log(`spent ≈ $${spent.toFixed(3)}`);
  log(`stocked ahead: ${buffers.map((b) => `${b.category} ${b.days}d`).join(", ")}`);

  const low = buffers.filter((b) => b.days < MIN_BUFFER_DAYS);
  if (low.length) {
    log(`\nLOW BUFFER: ${low.map((b) => b.category).join(", ")} under ${MIN_BUFFER_DAYS} days ahead — check the log above.`);
    process.exit(1);
  }
}

main();
