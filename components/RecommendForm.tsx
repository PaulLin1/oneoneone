"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkCategory } from "@/lib/types";

const CATEGORIES: { value: WorkCategory; label: string }[] = [
  { value: "poem", label: "Poem" },
  { value: "essay", label: "Essay" },
  { value: "story", label: "Short Story" },
];

const inputClass =
  "w-full border border-black/20 bg-paper px-3 py-2 font-serif text-base placeholder:text-ink-soft/60 focus:border-ink focus:outline-none";

export function RecommendForm() {
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [category, setCategory] = useState<WorkCategory>("poem");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, authorName, category, sourceUrl, note }),
    });

    if (res.ok) {
      setStatus("sent");
      setTitle("");
      setAuthorName("");
      setSourceUrl("");
      setNote("");
      return;
    }

    if (res.status === 401) {
      setErrorMessage("Your session may have expired — sign in again and retry.");
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMessage(body.error ?? "Something went wrong — try again.");
    }
    setStatus("error");
  }

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl tracking-tight sm:text-4xl">Recommend a work</h1>
        <p className="mt-4 max-w-lg font-serif text-base leading-relaxed text-ink-soft">
          Every recommendation goes through the same review as anything else that reaches the
          catalog — public domain only, verified before it&apos;s ever published (see{" "}
          <Link href="/about" className="underline decoration-black/20 underline-offset-4 hover:text-ink">
            About
          </Link>
          ). A link to a Gutenberg or Wikisource edition speeds that up a lot, but isn&apos;t
          required.
        </p>
      </div>

      {status === "sent" ? (
        <p className="border-t border-black/15 pt-10 font-serif text-base">
          Sent — thank you. It&apos;s in the review queue now.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 border-t border-black/15 pt-10">
          <div>
            <label htmlFor="title" className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Title
            </label>
            <input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="author" className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Author
            </label>
            <input
              id="author"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Category</span>
            <div className="mt-1.5 flex gap-4">
              {CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 font-serif text-sm">
                  <input
                    type="radio"
                    name="category"
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="sourceUrl" className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Source link <span className="normal-case text-ink-soft/70">(optional)</span>
            </label>
            <input
              id="sourceUrl"
              type="url"
              placeholder="https://www.gutenberg.org/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="note" className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Why this one? <span className="normal-case text-ink-soft/70">(optional)</span>
            </label>
            <textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>

          {errorMessage && <p className="text-sm text-pink">{errorMessage}</p>}

          <button
            type="submit"
            disabled={status === "sending"}
            className="bg-yellow px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Submit"}
          </button>
        </form>
      )}
    </>
  );
}
