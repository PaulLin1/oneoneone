"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The "unfailable" fallback for a missing portrait: pick your own source
 * image, it runs through the exact same digitization pass
 * (lib/portraitProcessing.ts) auto-discovery uses, and publishes straight
 * away — no search/retry loop needed since a human already chose the
 * source. Re-uploading always overwrites, so a bad crop is just "try a
 * different photo," not a dead end.
 */
export function UploadPortraitButton({ authorName }: { authorName: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("pending");
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("authorName", authorName);
      const res = await fetch("/api/admin/upload-portrait", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setStatus("done");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label
      className={`shrink-0 text-[10px] uppercase tracking-[0.1em] underline decoration-ink/20 underline-offset-4 transition-colors hover:decoration-ink ${
        status === "pending" ? "pointer-events-none opacity-50" : "cursor-pointer"
      }`}
      title={errorMessage ?? undefined}
    >
      {status === "pending" ? "Uploading…" : status === "done" ? "Published" : status === "error" ? "Failed — retry" : "Upload"}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
        disabled={status === "pending"}
      />
    </label>
  );
}
