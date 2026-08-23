import type { CSSProperties } from "react";

export function maskStyle(src: string): CSSProperties {
  return {
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };
}

/**
 * Renders the real portrait (a flat black-and-white PNG applied as a CSS
 * mask — see lib/authorPortraits.ts's authorSlug and the "Author
 * portraits" section in README.md) when one exists, or a generated
 * initial-letter mark when it doesn't.
 *
 * The initial is a stopgap for the short window between an author being
 * promoted and a real portrait getting published — not an accepted end
 * state. The actual target is a real photo for every author, always (see
 * "Author portraits" in README.md and the fetch/process/publish step in
 * content-pipeline.yml, which keeps trying alternate sources and a manual
 * crop rather than accepting the first failed attempt). Seeing an initial
 * in normal use means an author is still missing one, not that the design
 * intends it.
 */
export function AuthorMark({
  portraitUrl,
  authorName,
  accentBg,
  accentText,
  className,
  initialSizeClassName = "text-4xl",
}: {
  portraitUrl: string | null;
  authorName: string;
  accentBg: string;
  accentText: string;
  className: string;
  /** Font-size utility for the fallback initial — the two callers use very differently sized boxes. */
  initialSizeClassName?: string;
}) {
  if (portraitUrl) {
    return <div aria-hidden="true" className={`${className} ${accentBg}`} style={maskStyle(portraitUrl)} />;
  }

  const initial = authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div aria-hidden="true" className={`${className} ${accentBg} flex items-center justify-center`}>
      <span className={`font-serif ${initialSizeClassName} ${accentText}`}>{initial}</span>
    </div>
  );
}
