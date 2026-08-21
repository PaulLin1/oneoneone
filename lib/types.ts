export type WorkCategory = "poem" | "essay" | "story";
export type WorkDifficulty = "easy" | "medium" | "challenging";
export type WorkEra = "ancient" | "19th_century" | "early_20th_century" | "modern";

export type Work = {
  id: string;
  title: string;
  author: string;
  author_note: string | null;
  year: number | null;
  category: WorkCategory;
  text_content: string | null;
  description: string;
  source_name: string;
  source_url: string;
  public_domain: boolean;
  difficulty: WorkDifficulty;
  reading_minutes: number;
  era: WorkEra | null;
  region: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
};

/** The one shared daily puzzle — identical for every reader on a given date. */
export type DailySelection = {
  day: number;
  date: string;
  poem: Work;
  essay: Work;
  story: Work;
};
