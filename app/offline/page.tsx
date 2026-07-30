import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl shadow-black/30">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-lime-300">
          Workout Tracker
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Reconnect to load workouts, sign in, or save changes. Offline workout entry is
          not enabled yet.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-lime-300 px-5 text-sm font-black text-zinc-950 transition hover:bg-lime-200"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
