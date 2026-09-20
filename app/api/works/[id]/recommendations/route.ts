import { NextResponse } from "next/server";
import { getSimilarWorks } from "@/lib/recommendations";

/** Public — works similar to `id`, for a "you might also like" strip. No auth needed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const works = await getSimilarWorks(id);
  return NextResponse.json({ works });
}
