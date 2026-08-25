export default function AboutPage() {
  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <div className="mb-10">
        <h1 className="text-3xl tracking-tight sm:text-4xl">About</h1>
        <div className="mt-3 h-1.5 w-16 bg-yellow" aria-hidden="true" />
      </div>

      <div className="space-y-10 border-t border-black/15 pt-10 font-serif text-base leading-relaxed">
        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            The idea
          </h2>
          <p className="mt-3">
            Every day, oneoneone picks one poem, one essay, and one short story. Everyone who
            visits sees the same three. There&apos;s no algorithm and no personalization, so it
            works more like a newspaper than a feed: the same thing, for everyone, on the same
            day.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Ray Bradbury&apos;s thousand nights
          </h2>
          <p className="mt-3">
            This comes from a talk Ray Bradbury gave about his own reading habits. For a thousand
            nights, he read one short story, one poem, and one essay before bed, and said it
            shaped his whole career as a writer.
          </p>
          <p className="mt-4">
            He wasn&apos;t casual about what he picked, either. For short stories he wanted
            writers heavy on metaphor, like Poe, Hawthorne, Melville, and Roald Dahl, rather than
            the quiet, realistic fiction he thought had trained writers out of using imagery. For
            poems he read the classic masters, Shakespeare, Pope, Frost, instead of modern
            experimental verse. And for essays he picked writers who had nothing to do with
            literature at all, working in anthropology, zoology, or biology, like Loren Eiseley
            and Aldous Huxley, because they could describe a fact about nature so it landed like a
            metaphor.
          </p>
          <p className="mt-4">
            His point wasn&apos;t really about any one piece. Do this long enough and your head
            fills up with more ideas than you can consciously track. Eventually they start
            combining on their own, and what comes out when you write ends up actually yours.
          </p>
          <p className="mt-4">
            oneoneone is that same routine, made public. Anyone can start their own thousand
            nights today and read the same three things everyone else is reading.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            What we actually read
          </h2>
          <p className="mt-3">
            Everything in the catalog is public domain. We pull from Project Gutenberg,
            Wikisource, and similar archives, and verify each work before using it. That limits
            us: some of the writers Bradbury actually named, like Dahl, Huxley, and Eiseley, are
            still under copyright. When that happens we look for someone in the same vein instead,
            Poe, Hawthorne, and Saki standing in for Dahl, T. H. Huxley and John Muir standing in
            for Huxley and Eiseley. The goal is to keep the spirit of his list, not copy it
            exactly.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-2.5 w-2.5 shrink-0 bg-ink" aria-hidden="true" />
            Contact
          </h2>
          <p className="mt-3">
            Found a bad transcription? Have a work to suggest? Just want to say something? Email{" "}
            <a
              href="mailto:hello@readoneoneone.com"
              className="text-ink underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
            >
              hello@readoneoneone.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
