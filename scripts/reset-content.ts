import { getDb } from "@/lib/db";

/**
 * Wipes all content (content_candidates, works, work_tags, authors, tags)
 * for a fresh launch, while preserving everything user-linked (users,
 * accounts, sessions, reading_history).
 *
 * reading_history rows pointing at a deleted work would otherwise violate
 * reading_history_source_check (it requires external_title to be set
 * whenever work_id is null) — this backfills external_title/external_author
 * from the work being deleted in the same statement that nulls work_id, so
 * the read record survives as plain text instead of erroring out.
 *
 * Run: npx tsx scripts/reset-content.ts --yes
 * Against production specifically, bypass the .env.local-loading npm
 * alias and pass the URL inline instead:
 *   DATABASE_URL="<production URL>" npx tsx scripts/reset-content.ts --yes
 */
async function main() {
  if (process.argv[2] !== "--yes") {
    console.error(
      "This permanently deletes every row in content_candidates, works, work_tags, authors, and tags.\n" +
        "users, accounts, sessions, and reading_history are preserved.\n\n" +
        "Re-run with --yes to confirm: npx tsx scripts/reset-content.ts --yes"
    );
    process.exit(1);
  }

  const sql = getDb();

  await sql`
    update reading_history rh
    set work_id = null, external_title = w.title, external_author = a.name
    from works w
    join authors a on a.id = w.author_id
    where rh.work_id = w.id
  `;

  await sql`delete from content_candidates`;
  await sql`delete from works`;
  await sql`delete from authors`;
  await sql`delete from tags`;

  console.log("Reset complete: content_candidates, works, work_tags, authors, tags are now empty.");
  console.log("users, accounts, sessions, and reading_history were preserved.");
}

main();
