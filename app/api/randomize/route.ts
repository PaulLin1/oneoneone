import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Work, WorkCategory } from "@/lib/types";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deliberately outside the deterministic daily-selection contract in
 * lib/selection/algorithm.ts — this is a per-reader "give me something else"
 * escape hatch, so it uses plain Math.random() with no seed and is never
 * cached or persisted server-side. The canonical shared pick (Archive,
 * Share) never reads from this route.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const excludeParam = searchParams.get("exclude");
  const exclude = excludeParam && UUID_RE.test(excludeParam) ? excludeParam : null;

  if (!category || !CATEGORIES.includes(category as WorkCategory)) {
    return NextResponse.json({ error: "category must be one of poem, essay, story" }, { status: 400 });
  }

  const sql = getDb();
  let candidates: Work[];
  try {
    candidates = (await sql`
      select * from works_feed
      where is_active = true and category = ${category} and (${exclude}::uuid is null or id != ${exclude}::uuid)
    `) as unknown as Work[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load works.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No other works available in this category." }, { status: 404 });
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return NextResponse.json(pick);
}
