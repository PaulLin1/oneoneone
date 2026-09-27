export type WorkCategory = "poem" | "essay" | "story";

export type Work = {
  id: string;
  title: string;
  author: string;
  author_note: string | null;
  author_portrait_url: string | null;
  year: number | null;
  category: WorkCategory;
  text_content: string | null;
  description: string;
  source_name: string;
  source_url: string;
  public_domain: boolean;
  reading_minutes: number;
};

/** The one shared daily puzzle — identical for every reader on a given date. */
export type DailySelection = {
  day: number;
  date: string;
  poem: Work;
  essay: Work;
  story: Work;
};
