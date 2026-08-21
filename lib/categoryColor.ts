import type { WorkCategory } from "./types";

export const CATEGORY_ACCENT: Record<WorkCategory, { bg: string; text: string }> = {
  poem: { bg: "bg-blue", text: "text-white" },
  essay: { bg: "bg-pink", text: "text-white" },
  story: { bg: "bg-purple", text: "text-white" },
};
