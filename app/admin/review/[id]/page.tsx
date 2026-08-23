import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  getCandidate,
  editCandidate,
  promoteCandidate,
  rejectCandidate,
  ERAS,
  DIFFICULTIES,
  RIGHTS_STATUSES,
  type Era,
  type Difficulty,
  type RightsStatus,
} from "@/lib/contentReview";

const inputClass = "w-full border border-black/20 bg-paper px-3 py-2 font-serif text-sm focus:border-ink focus:outline-none";
const labelClass = "text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft";

async function requireReviewer() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    redirect("/admin/review");
  }
}

export default async function ReviewCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireReviewer();
  const { id } = await params;
  const candidate = await getCandidate(id);

  if (!candidate) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 items-center justify-center px-6">
        <p className="font-serif text-sm text-ink-soft">No candidate found with that id.</p>
      </main>
    );
  }

  async function saveEdit(formData: FormData) {
    "use server";
    await requireReviewer();
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await editCandidate(id, {
      description: String(formData.get("description") ?? "") || undefined,
      tags: tags.length > 0 ? tags : undefined,
      region: String(formData.get("region") ?? "") || undefined,
      readingMinutes: formData.get("readingMinutes") ? Number(formData.get("readingMinutes")) : undefined,
      rightsStatus: (formData.get("rightsStatus") as RightsStatus) || undefined,
      sourceUrl: String(formData.get("sourceUrl") ?? "") || undefined,
    });
    revalidatePath(`/admin/review/${id}`);
  }

  async function doPromote(formData: FormData) {
    "use server";
    await requireReviewer();
    const result = await promoteCandidate(id, {
      era: formData.get("era") as Era,
      difficulty: (formData.get("difficulty") as Difficulty) || undefined,
      forcePd: formData.get("forcePd") === "on",
    });
    if ("error" in result) {
      // Nothing fancy for the error path — re-render the page with the
      // candidate unchanged; the edit form above is where the fix happens.
      revalidatePath(`/admin/review/${id}`);
      return;
    }
    redirect("/admin/review");
  }

  async function doReject(formData: FormData) {
    "use server";
    await requireReviewer();
    await rejectCandidate(id, String(formData.get("notes") ?? "") || undefined);
    redirect("/admin/review");
  }

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-8">
        <h1 className="text-2xl tracking-tight sm:text-3xl">{candidate.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {candidate.author_name} · {candidate.category} · rights: {candidate.rights_status} · tier:{" "}
          {candidate.source_tier}
        </p>
      </div>

      <section className="mb-10 max-h-64 overflow-y-auto border border-black/15 bg-black/[0.02] p-4 font-serif text-sm leading-relaxed whitespace-pre-line">
        {candidate.text_content ?? "(no text yet — this came in as a recommendation with no source fetched)"}
      </section>

      <form action={saveEdit} className="mb-10 space-y-4 border-t border-black/15 pt-8">
        <h2 className={labelClass}>Edit</h2>
        <div>
          <label className={labelClass}>Description</label>
          <textarea name="description" rows={2} defaultValue={candidate.description ?? ""} className={`mt-1 ${inputClass}`} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input name="tags" defaultValue={(candidate.tags ?? []).join(", ")} className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass}>Region</label>
            <input name="region" defaultValue={candidate.region ?? ""} className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass}>Reading minutes</label>
            <input name="readingMinutes" type="number" min={1} defaultValue={candidate.reading_minutes ?? ""} className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass}>Rights status</label>
            <select name="rightsStatus" defaultValue={candidate.rights_status} className={`mt-1 ${inputClass}`}>
              {RIGHTS_STATUSES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Source URL</label>
          <input name="sourceUrl" defaultValue={candidate.source_url ?? ""} className={`mt-1 ${inputClass}`} />
        </div>
        <button type="submit" className="bg-black/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-black/10">
          Save
        </button>
      </form>

      <div className="grid gap-8 border-t border-black/15 pt-8 sm:grid-cols-2">
        <form action={doPromote} className="space-y-3">
          <h2 className={labelClass}>Promote</h2>
          <select name="era" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Era…
            </option>
            {ERAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select name="difficulty" defaultValue="medium" className={inputClass}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {candidate.rights_status !== "public_domain" && (
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" name="forcePd" /> Force-promote despite unverified rights
            </label>
          )}
          <button type="submit" className="bg-yellow px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:opacity-80">
            Promote
          </button>
        </form>

        <form action={doReject} className="space-y-3">
          <h2 className={labelClass}>Reject</h2>
          <textarea name="notes" rows={3} placeholder="Reason (kept for the record)" className={inputClass} />
          <button type="submit" className="border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-black/5">
            Reject
          </button>
        </form>
      </div>
    </main>
  );
}
