import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addExerciseToWorkoutAction,
  addSetAction,
  deleteSetAction,
  finishWorkoutAction,
  removeWorkoutExerciseAction,
} from "@/app/workouts/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WorkoutPageProps = {
  params: Promise<{ workoutId: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMetric(metric: { type: string; value: { toString(): string }; unit: string }) {
  const value = metric.value.toString().replace(/\.00$/, "");

  if (metric.type === "REPS") return `${value} reps`;
  if (metric.type === "WEIGHT") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "TIME") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "DISTANCE") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "LAPS") return `${value} laps`;

  return `${value} ${metric.unit.toLowerCase()}`;
}

export default async function WorkoutPage({ params }: WorkoutPageProps) {
  await requireUser();

  const { workoutId } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: true,
          sets: {
            orderBy: { order: "asc" },
            include: { metrics: true },
          },
        },
      },
    },
  });

  if (!workout) {
    notFound();
  }

  const addExercise = addExerciseToWorkoutAction.bind(null, workout.id);
  const finishWorkout = finishWorkoutAction.bind(null, workout.id);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
          <Link href="/" className="text-sm font-bold text-lime-300">
            ← Back to workouts
          </Link>

          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">{formatDate(workout.startedAt)}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {workout.endedAt ? "Workout complete" : "Active workout"}
              </h1>
            </div>

            {!workout.endedAt ? (
              <form action={finishWorkout}>
                <button className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-zinc-950">
                  Finish
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Add exercise</h2>
          <form action={addExercise} className="mt-4 flex gap-2">
            <input
              className="h-14 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
              name="name"
              placeholder="Bench Press"
              autoComplete="off"
              required
            />
            <button className="h-14 rounded-2xl bg-lime-300 px-5 font-black text-zinc-950">
              Add
            </button>
          </form>
        </section>

        {workout.exercises.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="font-black text-zinc-200">No exercises yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Add your first movement above.</p>
          </section>
        ) : (
          workout.exercises.map((entry) => {
            const addSet = addSetAction.bind(null, workout.id, entry.id);
            const removeExercise = removeWorkoutExerciseAction.bind(null, workout.id, entry.id);

            return (
              <section
                key={entry.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                      Exercise {entry.order + 1}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{entry.exercise.name}</h2>
                  </div>

                  <form action={removeExercise}>
                    <button className="rounded-full border border-red-400/40 px-3 py-2 text-sm font-bold text-red-200">
                      Delete
                    </button>
                  </form>
                </div>

                {entry.sets.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    {entry.sets.map((set) => {
                      const deleteSet = deleteSetAction.bind(null, workout.id, set.id);

                      return (
                        <div
                          key={set.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3"
                        >
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                              Set {set.order + 1}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-200">
                              {set.metrics.map(formatMetric).join(" · ")}
                            </p>
                          </div>

                          <form action={deleteSet}>
                            <button className="rounded-full bg-zinc-800 px-3 py-2 text-sm font-bold text-zinc-300">
                              Remove
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <form action={addSet} className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="mb-3 text-sm font-black text-zinc-300">Quick add set</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="metric-input" name="reps" inputMode="decimal" placeholder="Reps" />
                    <div className="flex gap-1">
                      <input className="metric-input" name="weight" inputMode="decimal" placeholder="Weight" />
                      <select className="metric-select" name="weightUnit" defaultValue="LB">
                        <option value="LB">lb</option>
                        <option value="KG">kg</option>
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <input className="metric-input" name="time" inputMode="decimal" placeholder="Time" />
                      <select className="metric-select" name="timeUnit" defaultValue="MINUTES">
                        <option value="SECONDS">sec</option>
                        <option value="MINUTES">min</option>
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <input className="metric-input" name="distance" inputMode="decimal" placeholder="Distance" />
                      <select className="metric-select" name="distanceUnit" defaultValue="MILES">
                        <option value="MILES">mi</option>
                        <option value="KM">km</option>
                        <option value="METERS">m</option>
                      </select>
                    </div>
                    <input className="metric-input" name="laps" inputMode="decimal" placeholder="Laps" />
                    <button className="h-12 rounded-xl bg-lime-300 px-4 font-black text-zinc-950">
                      Add set
                    </button>
                  </div>
                </form>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
