import type { CSSProperties } from "react";

function maskStyle(src: string): CSSProperties {
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
 * Renders the portrait (a flat black-and-white PNG applied as a CSS mask)
 * when one exists, or a generated initial-letter mark when it doesn't.
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
