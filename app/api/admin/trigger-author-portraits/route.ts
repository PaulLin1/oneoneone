import { auth } from "@/lib/auth";
import { dispatchWorkflow } from "@/lib/githubDispatch";

/**
 * The "Fetch portraits" button on /account. This does NOT run the portrait
 * pipeline itself — it can't: fetching/cropping/publishing a portrait needs
 * to write image files to disk before a human looks at the crop, and
 * Vercel's serverless functions have no writable filesystem for that. The
 * actual pipeline only runs safely in GitHub Actions (a real VM), so this
 * just calls GitHub's API to start that existing workflow, the same as
 * clicking "Run workflow" in the Actions tab by hand.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await dispatchWorkflow("author-portraits.yml");
  if ("error" in result) return Response.json(result, { status: 502 });
  return Response.json(result);
}
