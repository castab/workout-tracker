import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { createWorkoutAction } from "@/app/workouts/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function Home() {
  const user = await requireUser();
  const workouts = await prisma.workout.findMany({
    orderBy: { startedAt: "desc" },
    take: 8,
    include: {
      exercises: {
        include: { sets: true },
      },
    },
  });

  const activeWorkout = workouts.find((workout) => !workout.endedAt);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                Workout Tracker
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">
                Ready to train?
              </h1>
              <p className="mt-2 text-sm text-zinc-400">Signed in as {user.email}</p>
            </div>

            <form action={logoutAction}>
              <button className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500">
                Logout
              </button>
            </form>
          </div>
        </header>

        {activeWorkout ? (
          <Link
            href={`/workouts/${activeWorkout.id}`}
            className="rounded-3xl border border-lime-300/40 bg-lime-300 p-5 text-zinc-950 shadow-xl shadow-lime-950/20 transition hover:bg-lime-200"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em]">Active workout</p>
            <p className="mt-2 text-2xl font-black">Continue workout</p>
            <p className="mt-1 text-sm font-semibold">
              Started {formatDate(activeWorkout.startedAt)}
            </p>
          </Link>
        ) : (
          <form action={createWorkoutAction}>
            <button className="h-16 w-full rounded-3xl bg-lime-300 px-5 text-lg font-black text-zinc-950 shadow-xl shadow-lime-950/20 transition hover:bg-lime-200">
              Start a new workout
            </button>
          </form>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Recent workouts</h2>
              <p className="text-sm text-zinc-400">Your latest sessions and set counts.</p>
            </div>

            {activeWorkout ? (
              <form action={createWorkoutAction}>
                <button className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-black text-zinc-950">
                  New
                </button>
              </form>
            ) : null}
          </div>

          {workouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
              <p className="text-sm font-semibold text-zinc-300">No workouts yet.</p>
              <p className="mt-1 text-sm text-zinc-500">Start one when you get to the gym.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((workout) => {
                const setCount = workout.exercises.reduce(
                  (count, exercise) => count + exercise.sets.length,
                  0,
                );

                return (
                  <Link
                    href={`/workouts/${workout.id}`}
                    key={workout.id}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black">{formatDate(workout.startedAt)}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {workout.exercises.length} exercises · {setCount} sets
                        </p>
                      </div>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
                        {workout.endedAt ? "Done" : "Active"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
