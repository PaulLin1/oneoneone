import { NextResponse } from "next/server";
import { getDailySelection } from "@/lib/dailyPicks";
import { todayIso } from "@/lib/dateMath";

export async function GET() {
  try {
    // The server's own clock is authoritative — every reader gets the same
    // day's three regardless of their local clock/timezone.
    const selection = await getDailySelection(todayIso());
    if (!selection) {
      return NextResponse.json(
        { error: "Today's reading hasn't been published yet — check back shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json(selection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load today's reading.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
