import { dateForDay, globalDayNumber } from "@/lib/epoch";
import type { DailySelection, Work } from "@/lib/types";
import { CATEGORIES, readWork, workOn, type ScheduledWork } from "@/lib/works";

/**
 * Today's three come from data/works (see lib/works.ts). If a category has
 * nothing on or before the date — a fresh checkout with no data yet — the
 * sample work below stands in, so a page never renders empty.
 */

const BASE = { author_portrait_url: null, public_domain: true } as const;

const POEM: Work = {
  ...BASE,
  id: "sample-poem",
  title: "“Hope” is the thing with feathers",
  author: "Emily Dickinson",
  author_note: null,
  year: 1891,
  category: "poem",
  description: "Hope as a small bird that sings without words and never asks for anything in return.",
  source_name: "Wikisource",
  source_url: "https://en.wikisource.org/wiki/%22Hope%22_is_the_thing_with_feathers",
  reading_minutes: 1,
  text_content: `“Hope” is the thing with feathers –
That perches in the soul –
And sings the tune without the words –
And never stops – at all –

And sweetest – in the Gale – is heard –
And sore must be the storm –
That could abash the little Bird
That kept so many warm –

I’ve heard it in the chillest land –
And on the strangest Sea –
Yet – never – in Extremity,
It asked a crumb – of me.`,
};

const ESSAY: Work = {
  ...BASE,
  id: "sample-essay",
  title: "Of Studies",
  author: "Francis Bacon",
  author_note: null,
  year: 1625,
  category: "essay",
  description: "What reading is for, and how much of it to do — in one compressed page.",
  source_name: "Project Gutenberg",
  source_url: "https://www.gutenberg.org/ebooks/575",
  reading_minutes: 3,
  text_content: `Studies serve for delight, for ornament, and for ability. Their chief use for delight, is in privateness and retiring; for ornament, is in discourse; and for ability, is in the judgment, and disposition of business. For expert men can execute, and perhaps judge of particulars, one by one; but the general counsels, and the plots and marshalling of affairs, come best, from those that are learned.

To spend too much time in studies is sloth; to use them too much for ornament, is affectation; to make judgment wholly by their rules, is the humor of a scholar. They perfect nature, and are perfected by experience: for natural abilities are like natural plants, that need proyning, by study; and studies themselves, do give forth directions too much at large, except they be bounded in by experience.

Crafty men contemn studies, simple men admire them, and wise men use them; for they teach not their own use; but that is a wisdom without them, and above them, won by observation. Read not to contradict and confute; nor to believe and take for granted; nor to find talk and discourse; but to weigh and consider.

Some books are to be tasted, others to be swallowed, and some few to be chewed and digested; that is, some books are to be read only in parts; others to be read, but not curiously; and some few to be read wholly, and with diligence and attention.

Reading maketh a full man; conference a ready man; and writing an exact man.`,
};

const STORY: Work = {
  ...BASE,
  id: "sample-story",
  title: "The Artist",
  author: "Oscar Wilde",
  author_note: null,
  year: 1894,
  category: "story",
  description: "A sculptor who can only think in bronze, and the one image he has to melt down to make another.",
  source_name: "Wikisource",
  source_url: "https://en.wikisource.org/wiki/Poems_in_Prose_(Wilde)/The_Artist",
  reading_minutes: 2,
  text_content: `One evening there came into his soul the desire to fashion an image of The Pleasure that abideth for a Moment. And he went forth into the world to look for bronze. For he could think only in bronze.

But all the bronze of the whole world had disappeared, nor anywhere in the whole world was there any bronze to be found, save only the bronze of the image of The Sorrow that endureth for Ever.

Now this image he had himself, and with his own hands, fashioned, and had set it on the tomb of the one thing he had loved in life. On the tomb of the dead thing he had most loved had he set this image of his own fashioning, that it might serve as a sign of the love of man that dieth not, and a symbol of the sorrow of man that endureth for ever. And in the whole world there was no other bronze save the bronze of this image.

And he took the image he had fashioned, and set it in a great furnace, and gave it to the fire.

And out of the bronze of the image of The Sorrow that endureth for Ever he fashioned an image of The Pleasure that abideth for a Moment.`,
};

export function getDailySelection(date: string): DailySelection {
  return {
    day: globalDayNumber(date),
    date,
    poem: workOn("poem", date) ?? POEM,
    essay: workOn("essay", date) ?? ESSAY,
    story: workOn("story", date) ?? STORY,
  };
}

export type ArchiveDay = { day: number; date: string; works: ScheduledWork[] };

/**
 * Every past edition (day 1 up to yesterday), newest first, with the works
 * saved for exactly that date. Today isn't archived yet, and a day with no
 * saved works is left out rather than filled from a neighbour.
 */
export function getArchiveDays(today: string): ArchiveDay[] {
  const days: ArchiveDay[] = [];
  for (let day = globalDayNumber(today) - 1; day >= 1; day--) {
    const date = dateForDay(day);
    const works = CATEGORIES.map((category) => readWork(category, date)).filter(
      (work): work is ScheduledWork => work !== null
    );
    if (works.length) days.push({ day, date, works });
  }
  return days;
}
