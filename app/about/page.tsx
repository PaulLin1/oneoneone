export default function AboutPage() {
  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <h1 className="text-3xl tracking-tight sm:text-4xl">About</h1>
      </div>

      <div className="space-y-10 border-t border-black/15 pt-10 font-serif text-base leading-relaxed">
        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            The idea
          </h2>
          <p className="mt-3">
            oneoneone gives you one poem, one essay, and one short story — the same three, for
            every reader, every day. Not a feed tuned to what you already like. Not an algorithm
            guessing what you&apos;ll click next. Just three things, chosen once, for everyone —
            the way a newspaper used to arrive the same for the whole block.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Ray Bradbury&apos;s thousand nights
          </h2>
          <p className="mt-3">
            The shape of it comes from a lecture Ray Bradbury gave on the discipline he credited
            with his own career: read one short story, one poem, and one essay every night, for a
            thousand nights running.
          </p>
          <p className="mt-4">
            Not just anything, either. Bradbury was specific. Short stories from writers who dealt
            in metaphor — Poe, Hawthorne, Melville, Dahl — not the flat, quiet &ldquo;slice of
            life&rdquo; fiction he thought had trained a generation of writers out of using imagery
            at all. Poems from the historical masters — Shakespeare, Pope, Frost — not
            experimental modern verse he considered a dead end. And essays reaching outside
            literature entirely: anthropology, zoology, biology, archaeology — writers like Loren
            Eiseley and Aldous Huxley, who could make a fact about the natural world land like a
            metaphor.
          </p>
          <p className="mt-4">
            His point was never really about any single piece. It was volume and variety,
            sustained long enough that your head fills up with more images and ideas than you can
            consciously track — until they start colliding and combining on their own, and what
            comes out the other end of your own writing is something that&apos;s actually yours.
          </p>
          <p className="mt-4">
            oneoneone is that program, run as a public ritual instead of a private one. One
            reader&apos;s thousand nights, structured so anyone can start theirs today, and see
            the same three things everyone else sees, on the same day.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            What we actually read
          </h2>
          <p className="mt-3">
            Everything in the catalog is public domain — sourced from Project Gutenberg,
            Wikisource, and similar archives, verified rather than assumed. That&apos;s a real
            constraint: several of the writers Bradbury actually named — Dahl, Huxley, Eiseley —
            are still under copyright. Where that&apos;s true, the catalog reaches for writers in
            the same vein instead: the metaphor-dense short fiction of Poe, Hawthorne, and Saki
            standing in for Dahl; naturalist-essayists like T. H. Huxley and John Muir standing in
            for Huxley and Eiseley. The goal is the spirit of the assignment, not a museum-accurate
            reproduction of one man&apos;s reading list.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Contact
          </h2>
          <p className="mt-3">
            Found a bad transcription, have a work to suggest, or just want to say something?{" "}
            <a
              href="mailto:hello@oneoneone.com"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              hello@oneoneone.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
