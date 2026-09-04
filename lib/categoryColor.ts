import type { WorkCategory } from "./types";

// Three of the five shared accents (see design-system/tokens.css), one per
// category, in slot order. The wordmark in Masthead.tsx uses the same three.
export const CATEGORY_ACCENT: Record<WorkCategory, { bg: string; text: string }> = {
  poem: { bg: "bg-cyan", text: "text-white" },
  essay: { bg: "bg-red", text: "text-white" },
  story: { bg: "bg-iris", text: "text-white" },
};
