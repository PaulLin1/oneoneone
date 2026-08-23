import {
  listPendingCandidates,
  getCandidate,
  editCandidate,
  promoteCandidate,
  rejectCandidate,
  ERAS,
  RIGHTS_STATUSES,
  type Era,
  type Difficulty,
  type RightsStatus,
} from "@/lib/contentReview";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      flags[arg.slice(2)] = "true"; // boolean flags like --force-pd
    } else {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return flags;
}

async function listPending() {
  const rows = await listPendingCandidates();
  if (rows.length === 0) {
    console.log("No candidates awaiting review.");
    return;
  }
  console.log(`${rows.length} candidate(s) awaiting review:\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  [${r.category}]  ${r.title} — ${r.author_name}  (${r.source_name})`);
  }
}

async function show(id: string) {
  const c = await getCandidate(id);
  if (!c) {
    console.error(`No candidate found with id ${id}`);
    process.exit(1);
  }
  console.log(`Title:        ${c.title}`);
  console.log(`Author:       ${c.author_name}`);
  console.log(`Year:         ${c.year ?? "(unset)"}`);
  console.log(`Category:     ${c.category}`);
  console.log(`Source:       ${c.source_name} — ${c.source_url ?? "(unset)"}`);
  console.log(`Region:       ${c.region ?? "(unset)"}`);
  console.log(`Tags:         ${(c.tags ?? []).join(", ") || "(none)"}`);
  console.log(`Reading time: ${c.reading_minutes ?? "(unset)"} min`);
  console.log(`Description:  ${c.description ?? "(unset — required before promoting)"}`);
  console.log(`Rights:       ${c.rights_status} (source tier: ${c.source_tier})`);
  console.log(`Origin:       ${c.origin}`);
  console.log(`\n--- text_content ---\n`);
  console.log(c.text_content ?? "(unset — required before promoting)");
}

async function edit(id: string, flags: Record<string, string>) {
  if (flags["rights-status"] && !RIGHTS_STATUSES.includes(flags["rights-status"] as RightsStatus)) {
    console.error(`--rights-status must be one of: ${RIGHTS_STATUSES.join(", ")}`);
    process.exit(1);
  }
  const result = await editCandidate(id, {
    description: flags.description,
    tags: flags.tags ? flags.tags.split(",").map((t) => t.trim()) : undefined,
    region: flags.region,
    readingMinutes: flags["reading-minutes"] ? Number(flags["reading-minutes"]) : undefined,
    rightsStatus: flags["rights-status"] as RightsStatus | undefined,
    sourceUrl: flags["source-url"],
  });
  if ("error" in result) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(`Updated candidate ${id}. Run \`npm run review -- show ${id}\` to review.`);
}

async function promote(id: string, flags: Record<string, string>) {
  if (flags.era && !ERAS.includes(flags.era as Era)) {
    console.error(`--era must be one of: ${ERAS.join(", ")}`);
    process.exit(1);
  }
  const result = await promoteCandidate(id, {
    era: flags.era as Era,
    difficulty: flags.difficulty as Difficulty | undefined,
    forcePd: flags["force-pd"] === "true",
  });
  if ("error" in result) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(`Promoted "${id}" → work ${result.workId}`);
}

async function reject(id: string, notes: string | undefined) {
  await rejectCandidate(id, notes);
  console.log(`Rejected candidate ${id}`);
}

async function main() {
  const [cmd, arg, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "list") {
    await listPending();
    return;
  }
  if (cmd === "show" && arg) {
    await show(arg);
    return;
  }
  if (cmd === "edit" && arg) {
    await edit(arg, parseFlags(rest));
    return;
  }
  if (cmd === "promote" && arg) {
    await promote(arg, parseFlags(rest));
    return;
  }
  if (cmd === "reject" && arg) {
    await reject(arg, rest.filter((a) => !a.startsWith("--")).join(" ") || undefined);
    return;
  }

  console.log("Usage:");
  console.log("  npm run review                              # list candidates awaiting review");
  console.log("  npm run review -- show <candidate-id>        # print full details + text");
  console.log(
    "  npm run review -- edit <candidate-id> [--description=\"...\"] [--tags=a,b,c] [--region=...] [--reading-minutes=N] [--rights-status=public_domain|licensed|unverified] [--source-url=...]"
  );
  console.log(
    "  npm run review -- promote <candidate-id> --era=ancient|19th_century|early_20th_century|modern [--difficulty=easy|medium|challenging] [--force-pd]"
  );
  console.log("  npm run review -- reject <candidate-id> [notes]");
  process.exitCode = 1;
}

main();
