import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

type SeedWork = {
  title: string;
  author: string;
  author_note?: string;
  year: number;
  category: "poem" | "essay" | "story";
  text_content: string;
  description: string;
  source_name: string;
  source_url: string;
  public_domain: true;
  difficulty: "easy" | "medium" | "challenging";
  reading_minutes: number;
  era: "ancient" | "19th_century" | "early_20th_century" | "modern";
  region?: string;
  tags: string[];
};

async function getOrCreateAuthorId(name: string, bio: string | undefined): Promise<string> {
  const rows = await sql`
    insert into authors (name, bio)
    values (${name}, ${bio ?? null})
    on conflict (name) do update set bio = coalesce(excluded.bio, authors.bio)
    returning id
  `;
  return rows[0].id as string;
}

async function getOrCreateTagId(slug: string): Promise<string> {
  const rows = await sql`
    insert into tags (slug)
    values (${slug})
    on conflict (slug) do update set slug = excluded.slug
    returning id
  `;
  return rows[0].id as string;
}

async function main() {
  const seedPath = path.join(process.cwd(), "seed", "works.json");
  const works: SeedWork[] = JSON.parse(readFileSync(seedPath, "utf-8"));

  console.log(`Seeding ${works.length} works from ${seedPath}…`);

  // Upsert on (title, author_id) so reruns are idempotent without needing
  // fixed ids in the seed file. Tag links are dropped and rebuilt each run
  // — simplest way to keep them in sync with the seed file.
  for (const work of works) {
    try {
      const authorId = await getOrCreateAuthorId(work.author, work.author_note);

      // `public_domain` is a generated column (derived from rights_status —
      // see db/migrations/0003) and can't be inserted directly; every seed
      // entry is verified PD per seed/README.md's sourcing rules, so this is
      // always 'public_domain', not just carrying the boolean through.
      const rightsStatus = work.public_domain ? "public_domain" : "unverified";

      const rows = await sql`
        insert into works (
          title, author_id, year, category, text_content, description,
          source_name, source_url, rights_status, difficulty,
          reading_minutes, era, region, status, origin
        ) values (
          ${work.title}, ${authorId}, ${work.year}, ${work.category},
          ${work.text_content}, ${work.description}, ${work.source_name},
          ${work.source_url}, ${rightsStatus}, ${work.difficulty},
          ${work.reading_minutes}, ${work.era}, ${work.region ?? null},
          'approved', 'curated'
        )
        on conflict (title, author_id) do update set
          year = excluded.year,
          category = excluded.category,
          text_content = excluded.text_content,
          description = excluded.description,
          source_name = excluded.source_name,
          source_url = excluded.source_url,
          rights_status = excluded.rights_status,
          difficulty = excluded.difficulty,
          reading_minutes = excluded.reading_minutes,
          era = excluded.era,
          region = excluded.region,
          status = 'approved',
          updated_at = now()
        returning id
      `;
      const workId = rows[0].id as string;

      await sql`delete from work_tags where work_id = ${workId}`;
      for (const tagSlug of work.tags) {
        const tagId = await getOrCreateTagId(tagSlug);
        await sql`
          insert into work_tags (work_id, tag_id)
          values (${workId}, ${tagId})
          on conflict do nothing
        `;
      }

      console.log(`  ✓ ${work.category.padEnd(6)} — ${work.title} (${work.author})`);
    } catch (err) {
      console.error(
        `Failed to upsert "${work.title}" by ${work.author}:`,
        err instanceof Error ? err.message : err
      );
      process.exitCode = 1;
    }
  }

  console.log("Done.");
}

main();
