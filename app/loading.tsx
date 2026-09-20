export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 sm:px-10">
      <div className="flex gap-2" aria-hidden="true">
        <span className="h-3 w-3 animate-pulse bg-cyan [animation-delay:0ms]" />
        <span className="h-3 w-3 animate-pulse bg-red [animation-delay:150ms]" />
        <span className="h-3 w-3 animate-pulse bg-iris [animation-delay:300ms]" />
      </div>
      <p className="text-sm text-ink-soft">Loading today&apos;s three…</p>
    </main>
  );
}
