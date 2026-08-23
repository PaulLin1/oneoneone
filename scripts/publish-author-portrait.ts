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
 */
async function publishOne(name: string): Promise<void> {
  const slug = authorSlug(name);
  const filePath = path.join(STAGING_DIR, `${slug}.png`);

  if (!existsSync(filePath)) {
    console.error(`  ✗ ${name}: no staged file at public/authors/_staging/${slug}.png`);
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

  unlinkSync(filePath);
  console.log(`  ✓ ${name} → ${url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const names = args.includes("--all")
    ? readdirSync(existsSync(STAGING_DIR) ? STAGING_DIR : "/dev/null")
        .filter((f) => f.endsWith(".png"))
        .map((f) => f.replace(/\.png$/, ""))
    : args;

  if (names.length === 0) {
    console.log("Usage:");
    console.log('  npm run publish-author-portrait -- "Edgar Allan Poe"');
    console.log("  npm run publish-author-portrait -- --all   # publish everything currently staged");
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
    await publishOne(name);
  }
}

main();
