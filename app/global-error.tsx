"use client";

// Last-resort boundary for errors thrown inside the root layout itself —
// the normal layout (and its styles) may not have rendered, so this can't
// depend on globals.css or any shared component; it renders its own
// <html>/<body> per the Next.js App Router contract.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "4rem 1.5rem" }}>
        <h1>Something went wrong</h1>
        <p>Try reloading the page.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
