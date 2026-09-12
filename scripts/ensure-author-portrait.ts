import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { authorSlug } from "@/lib/authorPortraits";

/**
 * The foolproof primitive for the daily pipeline: given an author name, get
 * a real published portrait or fail loudly. It chains the three existing
 * steps — fetch candidates, process + score them, publish the winner — and
 * exits non-zero if it can't clear the score bar.
 *
 *   npm run ensure-author-portrait -- "Samuel Taylor Coleridge"
 *   npm run ensure-author-portrait -- --all            # every portrait_url-null author
 *   npm run ensure-author-portrait -- "Name" --min-score=0.3
 *
 * In content-pipeline.yml this runs BEFORE add-daily for each of the day's
 * three authors. Exit 0 → the author has a portrait, promote the work.
 * Exit non-zero → no usable portrait exists for this author right now;
 * discard that work and discover a different one in the same category. That
 * swap is the guarantee that every published author has a real face, not an
 * initial-letter placeholder.
 *
 * It does NOT do the visual sanity check a human/agent still should — a
 * score can pass on an odd crop. The daily prompt keeps a "Read the
 * published stencil once" step on top of this.
 */

const STAGING_DIR = path.join(process.cwd(), "public", "authors", "_staging");
const DEFAULT_MIN_SCORE = 0.35;

function run(script: string, args: string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync("npm", ["run", script, "--", ...args], {
      encoding: "utf-8",
      stdio: ["inherit", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

type BestResult = { variant: string | null; score: number; faceFound: boolean; passes: boolean };

function readResult(slug: string): BestResult | null {
  const file = path.join(STAGING_DIR, `${slug}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as BestResult;
  } catch {
    return null;
  }
}

async function ensureOne(name: string, minScore: number): Promise<boolean> {
  const slug = authorSlug(name);
  console.log(`\n── ${name} ──`);

  const fetched = run("fetch-author-portrait", [name]);
  process.stdout.write(fetched.output);
  if (!fetched.output.includes(`candidate(s):`)) {
    console.error(`✗ ${name}: no candidate images from Wikipedia or Commons.`);
    return false;
  }

  const processed = run("process-author-portraits", [`--min-score=${minScore}`]);
  process.stdout.write(processed.output);

  const result = readResult(slug);
  if (!result) {
    console.error(`✗ ${name}: processing produced no result for "${slug}".`);
    return false;
  }
  if (!result.passes) {
    console.error(
      `✗ ${name}: best candidate scored ${result.score.toFixed(2)}` +
        `${result.faceFound ? "" : " with no detected face"} — below the bar. ` +
        `Pick a different work for this category.`
    );
    return false;
  }

  const variantArg = result.variant ? [`--variant=${Number(result.variant)}`] : [];
  const published = run("publish-author-portrait", [name, ...variantArg]);
  process.stdout.write(published.output);
  if (!published.ok || !published.output.includes("→ http")) {
    console.error(`✗ ${name}: publish step failed.`);
    return false;
  }

  console.log(`✓ ${name}: portrait published (score ${result.score.toFixed(2)}).`);
  return true;
}

async function backlogNames(): Promise<string[]> {
  const { neon } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL environment variable.");
    process.exit(1);
  }
  const sql = neon(url);
  const rows = await sql`select name from authors where portrait_url is null order by name`;
  return rows.map((r) => r.name as string);
}

async function main() {
  const args = process.argv.slice(2);
  const minScoreArg = args.find((a) => a.startsWith("--min-score="));
  const minScore = minScoreArg ? Number(minScoreArg.slice("--min-score=".length)) : DEFAULT_MIN_SCORE;

  const names = args.includes("--all")
    ? await backlogNames()
    : args.filter((a) => !a.startsWith("--"));

  if (names.length === 0) {
    console.log("Usage:");
    console.log('  npm run ensure-author-portrait -- "Edgar Allan Poe"');
    console.log("  npm run ensure-author-portrait -- --all   # every author with portrait_url null");
    process.exitCode = 1;
    return;
  }

  const failed: string[] = [];
  for (const name of names) {
    const ok = await ensureOne(name, minScore).catch((err) => {
      console.error(`✗ ${name}:`, err instanceof Error ? err.message : err);
      return false;
    });
    if (!ok) failed.push(name);
  }

  console.log(`\n${names.length - failed.length}/${names.length} author(s) have a published portrait.`);
  if (failed.length > 0) {
    console.error(`✗ No usable portrait for: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main();
