const REPO = "PaulLin1/oneoneone";

/**
 * Starts a GitHub Actions workflow via workflow_dispatch — the same thing
 * as clicking "Run workflow" in the Actions tab by hand. Shared by every
 * /api/admin route that hands work off to a workflow instead of running it
 * directly (portraits need a real filesystem; deep content discovery needs
 * real web search — neither is safe or sane to run inline in a Vercel
 * function).
 */
export async function dispatchWorkflow(
  workflowFile: string,
  inputs?: Record<string, string>
): Promise<{ error: string } | { ok: true }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { error: "GITHUB_DISPATCH_TOKEN isn't configured — see .env.local.example." };
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { error: `GitHub API returned ${res.status}: ${body || res.statusText}` };
  }

  return { ok: true };
}
