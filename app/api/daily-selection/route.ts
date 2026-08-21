import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { selectDailyWorks } from "@/lib/selection/algorithm";
import { todayIso } from "@/lib/dateMath";
import type { Work } from "@/lib/types";

export async function GET() {
  const sql = getDb();
  let works: Work[];
  try {
    works = (await sql`select * from works_feed where is_active = true`) as unknown as Work[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load works.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    // The server's own clock is authoritative — every reader gets the same
    // day's puzzle regardless of their local clock/timezone.
    const selection = selectDailyWorks({ date: todayIso(), works });
    return NextResponse.json(selection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Selection failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
