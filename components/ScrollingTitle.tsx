"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps a title on one line. If it's short enough to fit, it just sits
 * still, centered, same as plain text. If it overflows its container, it
 * auto-scrolls (marquee) instead of wrapping or clipping with an ellipsis.
 */
export function ScrollingTitle({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [duration, setDuration] = useState(8);

  useEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const textWidth = textEl.scrollWidth;
      const fits = textWidth <= container.clientWidth;
      setOverflowing(!fits);
      // Roughly constant scroll speed regardless of title length.
      setDuration(Math.max(textWidth / 40, 6));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <div
        className={overflowing ? "marquee-track inline-flex" : "inline-flex justify-center"}
        style={overflowing ? { animationDuration: `${duration}s`, width: "max-content" } : undefined}
      >
        <span ref={textRef} className="inline-block shrink-0">
          {text}
        </span>
        {overflowing && (
          <span aria-hidden="true" className="inline-block shrink-0 pl-12">
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
