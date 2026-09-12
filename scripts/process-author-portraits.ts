import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { processPortraitScored } from "@/lib/portraitProcessing";

const SOURCE_DIR = path.join(process.cwd(), "public", "authors", "_source");
// Staged, not final: nothing under public/authors/ is committed or served
// directly anymore (see db/migrations/0006_portrait_urls.sql) — this is a
// local scratch space for a human or agent to glance over the mechanical
// output before scripts/publish-author-portrait.ts uploads the good ones
// to R2 and updates authors.portrait_url.
const OUTPUT_DIR = path.join(process.cwd(), "public", "authors", "_staging");

const IMAGE_RE = /\.(jpe?g|png|tiff?)$/i;

/**
 * "<slug>__03.jpg" → { slug: "<slug>", variant: "03" },
 * "edgar-allan-poe.png" → { slug: "edgar-allan-poe", variant: null }.
 * scripts/fetch-author-portrait.ts writes numbered candidates; a hand-
 * dropped single file has no suffix. The variant label is carried straight
 * through to _staging/<slug>__NN.png so `publish -- "Name" --variant=NN`
 * lines up.
 */
function parseName(file: string): { slug: string; variant: string | null } {
  const stem = path.basename(file, path.extname(file));
  const m = stem.match(/^(.*)__(\d+)$/);
  return m ? { slug: m[1], variant: m[2] } : { slug: stem, variant: null };
}

/**
 * Best score a stencil needs to clear to count as a real portrait rather
 * than a fallback. Below this the crop is usually a sliver of face, a solid
 * slab, or noise. scripts/ensure-author-portrait.ts passes `--min-score` to
 * turn this into a hard gate (non-zero exit); a bare run just flags it.
 *
 * A candidate with no detected face has to clear a higher bar
 * (`+ NO_FACE_MIN_SCORE_MARGIN`): its stencil might be a clean bust (often
 * true of soft engravings the detector can't read) or it might be an
 * abstract blob, and the score alone can't always tell them apart.
 */
const DEFAULT_MIN_SCORE = 0.35;
const NO_FACE_MIN_SCORE_MARGIN = 0.25;
/**
 * How much a detected face is worth when ranking candidates against each
 * other — enough to prefer a decent face crop over a slightly better
 * faceless one, not so much that a poor face crop beats a clearly superior
 * bust.
 */
const FACE_RANK_BONUS = 0.15;

type BestResult = { variant: string | null; score: number; faceFound: boolean; passes: boolean };

async function main() {
  const minScoreArg = process.argv.find((a) => a.startsWith("--min-score="));
  const minScore = minScoreArg ? Number(minScoreArg.slice("--min-score=".length)) : null;
  const gate = minScore !== null && Number.isFinite(minScore);

  if (!existsSync(SOURCE_DIR) || readdirSync(SOURCE_DIR).filter((f) => IMAGE_RE.test(f)).length === 0) {
    console.error(`No staged images in ${path.relative(process.cwd(), SOURCE_DIR)} — run fetch-author-portrait first.`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const failures: string[] = [];

  // Group every candidate file by the author slug it belongs to.
  const bySlug = new Map<string, Array<{ file: string; variant: string | null }>>();
  for (const file of readdirSync(SOURCE_DIR).filter((f) => IMAGE_RE.test(f)).sort()) {
    const { slug, variant } = parseName(file);
    const group = bySlug.get(slug) ?? [];
    group.push({ file, variant });
    bySlug.set(slug, group);
  }

  const summary: string[] = [];

  for (const [slug, candidates] of bySlug) {
    // Clear this author's previous staged output so a re-run can't leave a
    // stale <slug>.png or an orphaned <slug>__NN.png behind.
    for (const existing of readdirSync(OUTPUT_DIR)) {
      if (existing === `${slug}.png` || existing === `${slug}.json` || existing.startsWith(`${slug}__`)) {
        rmSync(path.join(OUTPUT_DIR, existing), { force: true });
      }
    }

    let best: { png: Buffer; score: number; variant: string | null; faceFound: boolean } | null = null;
    const scored: Array<{ label: string; score: number; faceFound: boolean }> = [];

    for (const { file, variant } of candidates) {
      try {
        const { png, score, faceFound } = await processPortraitScored(readFileSync(path.join(SOURCE_DIR, file)));
        scored.push({ label: variant ? `variant ${variant}` : "single", score, faceFound });
        // Keep every candidate around for a side-by-side look.
        if (candidates.length > 1 && variant) {
          writeFileSync(path.join(OUTPUT_DIR, `${slug}__${variant}.png`), png);
        }
        const rankOf = (s: number, f: boolean) => s + (f ? FACE_RANK_BONUS : 0);
        if (!best || rankOf(score, faceFound) > rankOf(best.score, best.faceFound)) {
          best = { png, score, variant, faceFound };
        }
      } catch (err) {
        console.error(`  ✗ ${file}:`, err instanceof Error ? err.message : err);
      }
    }

    if (!best) {
      summary.push(`${slug}: all ${candidates.length} candidate(s) failed to process`);
      failures.push(`${slug} (every candidate errored)`);
      continue;
    }

    writeFileSync(path.join(OUTPUT_DIR, `${slug}.png`), best.png);

    const rankOf = (s: { score: number; faceFound: boolean }) =>
      s.score + (s.faceFound ? FACE_RANK_BONUS : 0);
    const ranked = scored
      .sort((a, b) => rankOf(b) - rankOf(a))
      .map((s) => `${s.label} ${s.score.toFixed(2)}${s.faceFound ? "" : " (no face)"}`)
      .join(", ");
    console.log(`  ✓ ${slug} → ${slug}.png (best of ${candidates.length}: ${ranked})`);

    const bar =
      (gate ? minScore! : DEFAULT_MIN_SCORE) + (best.faceFound ? 0 : NO_FACE_MIN_SCORE_MARGIN);
    const passes = best.score >= bar;

    // Machine-readable result for scripts/ensure-author-portrait.ts.
    const result: BestResult = {
      variant: best.variant,
      score: best.score,
      faceFound: best.faceFound,
      passes,
    };
    writeFileSync(path.join(OUTPUT_DIR, `${slug}.json`), JSON.stringify(result, null, 2));

    if (!passes) {
      failures.push(
        `${slug} (best score ${best.score.toFixed(2)}${best.faceFound ? "" : ", no face detected"})`
      );
    }
    summary.push(
      `${slug}: <slug>.png is ${best.variant ? `candidate ${best.variant} (publish plain, or --variant=${best.variant})` : "the single candidate"}` +
        ` · score ${best.score.toFixed(2)}${best.faceFound ? "" : " · NO FACE"}` +
        (passes ? "" : " — BELOW BAR, do not publish as-is")
    );
  }

  console.log(
    `\nProcessed ${bySlug.size} author(s) into public/authors/_staging/. <slug>.png is the best-scoring ` +
      `candidate; <slug>__NN.png are the alternatives (when there was more than one). This is a mechanical ` +
      `pass — Read <slug>.png before treating it as final, then ` +
      `\`npm run publish-author-portrait -- "Author Name"\` (or \`--variant=N\` to pick a specific candidate, or ` +
      `\`--all\`) to upload to R2 and update authors.portrait_url. Delete a bad one from _staging/ rather than ` +
      `publishing it.\n\n${summary.join("\n")}`
  );

  if (gate && failures.length > 0) {
    console.error(
      `\n✗ ${failures.length} author(s) below the --min-score=${minScore} bar:\n  - ${failures.join("\n  - ")}\n` +
        `  Get better source images (a cleaner head-and-shoulders) or, in the daily pipeline, pick a different work.`
    );
    process.exitCode = 1;
  }
}

main();
