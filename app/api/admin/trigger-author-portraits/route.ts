import { auth } from "@/lib/auth";

const REPO = "PaulLin1/oneoneone";
const WORKFLOW_FILE = "author-portraits.yml";

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

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return Response.json(
      { error: "GITHUB_DISPATCH_TOKEN isn't configured — see .env.local.example." },
      { status: 500 }
    );
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ error: `GitHub API returned ${res.status}: ${body || res.statusText}` }, { status: 502 });
  }

  return Response.json({ ok: true });
}
