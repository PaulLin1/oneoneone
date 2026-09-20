import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecommendationsForUser } from "@/lib/recommendations";

/** Personalized picks for the signed-in reader, based on their reading history. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to get personalized recommendations." }, { status: 401 });
  }

  const works = await getRecommendationsForUser(session.user.id);
  return NextResponse.json({ works });
}
