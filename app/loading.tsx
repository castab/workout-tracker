export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-lime-300">
          Workout Tracker
        </p>
        <div className="mt-6 space-y-3" role="status" aria-label="Loading workout tracker">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-zinc-800" />
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-800/80" />
          <p className="pt-2 text-sm font-semibold text-zinc-400">Loading your workout…</p>
        </div>
      </section>
    </main>
  );
}
