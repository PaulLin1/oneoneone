import { readFileSync, unlinkSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { uploadAuthorPortrait } from "@/lib/r2";
import { authorSlug } from "@/lib/authorPortraits";

const STAGING_DIR = path.join(process.cwd(), "public", "authors", "_staging");

/**
 * The step that used to be "edit AUTHORS_WITH_PORTRAIT in lib/authorPortraits.ts
 * and commit a PNG" — now a plain data write. Takes a *reviewed* image
 * (see scripts/process-author-portraits.ts) out of local staging, uploads
 * it to R2, and points authors.portrait_url at it. No git commit, no
 * redeploy: the next page load just picks up the new URL from the
 * database.
 *
 * By default it publishes public/authors/_staging/<slug>.png (the best-
 * scoring candidate). Pass --variant=N to publish <slug>__NN.png instead,
 * when the top-scored one isn't the best likeness.
 */
async function publishOne(name: string, variant: number | null): Promise<void> {
  const slug = authorSlug(name);
  const fileName = variant ? `${slug}__${String(variant).padStart(2, "0")}.png` : `${slug}.png`;
  const filePath = path.join(STAGING_DIR, fileName);

  if (!existsSync(filePath)) {
    console.error(`  ✗ ${name}: no staged file at public/authors/_staging/${fileName}`);
    return;
  }

  const data = readFileSync(filePath);
  const url = await uploadAuthorPortrait(slug, data);

  const sql = getDb();
  const rows = (await sql`
    update authors set portrait_url = ${url} where name = ${name} returning id
  `) as unknown as { id: string }[];
  if (rows.length === 0) {
    console.error(`  ✗ ${name}: uploaded to R2 (${url}) but no author row matches this exact name — fix the ` +
      `name and re-run, the R2 object is already there so it won't re-upload work.`);
    return;
  }

  // Clear every staged file for this author — the choice is made.
  for (const file of readdirSync(STAGING_DIR)) {
    if (file === `${slug}.png` || file === `${slug}.json` || file.startsWith(`${slug}__`)) {
      unlinkSync(path.join(STAGING_DIR, file));
    }
  }
  console.log(`  ✓ ${name}${variant ? ` (variant ${variant})` : ""} → ${url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const variantArg = args.find((a) => a.startsWith("--variant="));
  const variant = variantArg ? Number(variantArg.slice("--variant=".length)) : null;
  if (variantArg && (!Number.isInteger(variant) || variant! < 1)) {
    console.error("--variant must be a positive integer (the NN in <slug>__NN.png).");
    process.exitCode = 1;
    return;
  }

  const staged = existsSync(STAGING_DIR) ? readdirSync(STAGING_DIR) : [];
  const positional = args.filter((a) => !a.startsWith("--"));
  const names = args.includes("--all")
    ? staged.filter((f) => f.endsWith(".png") && !f.includes("__")).map((f) => f.replace(/\.png$/, ""))
    : positional;

  if (names.length === 0) {
    console.log("Usage:");
    console.log('  npm run publish-author-portrait -- "Edgar Allan Poe"');
    console.log('  npm run publish-author-portrait -- "Edgar Allan Poe" --variant=3');
    console.log("  npm run publish-author-portrait -- --all   # publish the best-scoring image for everything staged");
    process.exitCode = 1;
    return;
  }

  // --all gives slugs (from filenames), not names — look up the real name
  // per slug from the DB so the update-by-name query below still matches.
  let resolvedNames = names;
  if (args.includes("--all")) {
    const sql = getDb();
    const authors = (await sql`select name from authors`) as unknown as { name: string }[];
    const bySlug = new Map(authors.map((a) => [authorSlug(a.name), a.name]));
    resolvedNames = names.map((slug) => bySlug.get(slug) ?? slug);
  }

  console.log(`Publishing ${resolvedNames.length} portrait(s)…\n`);
  for (const name of resolvedNames) {
    await publishOne(name, args.includes("--all") ? null : variant);
  }
}

main();
