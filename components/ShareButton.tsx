"use client";

import { useState } from "react";
import type { DailySelection } from "@/lib/types";

const ICON: Record<"poem" | "essay" | "story", string> = {
  poem: "◆",
  essay: "■",
  story: "●",
};

export function buildShareText(selection: DailySelection): string {
  const hashtag = `#oneoneoneday${selection.day}`;
  const lines = [
    `oneoneone — day ${selection.day}`,
    `${ICON.poem} ${selection.poem.title}`,
    `${ICON.essay} ${selection.essay.title}`,
    `${ICON.story} ${selection.story.title}`,
  ];
  lines.push(hashtag);
  return lines.join("\n");
}

export function ShareButton({ selection }: { selection: DailySelection }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText(selection);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="bg-yellow px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80"
    >
      {copied ? "Copied ✓" : `Share #oneoneoneday${selection.day}`}
    </button>
  );
}
