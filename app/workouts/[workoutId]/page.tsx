import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalDateTime } from "@/app/local-date-time";
import {
  addExerciseToWorkoutAction,
  addSetAction,
  deleteSetAction,
  finishWorkoutAction,
  removeWorkoutExerciseAction,
  updateSetAction,
  updateWorkoutExerciseNameAction,
} from "@/app/workouts/actions";
import { AddExerciseForm, type ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import { ExerciseNameEditor } from "@/app/workouts/[workoutId]/exercise-name-editor";
import { SetEntryEditor } from "@/app/workouts/[workoutId]/set-entry-editor";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WorkoutPageProps = {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ focusExercise?: string | string[]; finishError?: string | string[] }>;
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

function WorkoutDate({ date }: { date: Date }) {
  return <LocalDateTime isoString={date.toISOString()} fallback={formatDate(date)} weekday="short" />;
}

function formatMetricValue(value: { toString(): string }) {
  return value.toString().replace(/\.00$/, "");
}

function formatMetric(metric: { type: string; value: { toString(): string }; unit: string }) {
  const value = formatMetricValue(metric.value);

  if (metric.type === "REPS") return `${value} reps`;
  if (metric.type === "WEIGHT") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "TIME") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "DISTANCE") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "LAPS") return `${value} laps`;

  return `${value} ${metric.unit.toLowerCase()}`;
}

type ExerciseSuggestionRow = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: Date;
};

async function getExerciseSuggestions(): Promise<ExerciseSuggestion[]> {
  const suggestions = await prisma.$queryRaw<ExerciseSuggestionRow[]>`
    SELECT
      e.id,
      e.name,
      COUNT(*)::int AS "usageCount",
      MAX(we."createdAt") AS "lastUsedAt"
    FROM "WorkoutExercise" we
    JOIN "Exercise" e ON e.id = we."exerciseId"
    WHERE we."createdAt" >= NOW() - INTERVAL '90 days'
    GROUP BY e.id, e.name
    ORDER BY COUNT(*) DESC, MAX(we."createdAt") DESC, e.name ASC
    LIMIT 50
  `;

  return suggestions.map((suggestion) => ({
    ...suggestion,
    lastUsedAt: suggestion.lastUsedAt.toISOString(),
  }));
}

export default async function WorkoutPage({ params, searchParams }: WorkoutPageProps) {
  await requireUser();

  const { workoutId } = await params;
  const resolvedSearchParams = await searchParams;
  const focusedExercise = resolvedSearchParams.focusExercise;
  const focusedExerciseId = Array.isArray(focusedExercise) ? focusedExercise[0] : focusedExercise;
  const finishError = Array.isArray(resolvedSearchParams.finishError)
    ? resolvedSearchParams.finishError[0]
    : resolvedSearchParams.finishError;
  const [workout, exerciseSuggestions] = await Promise.all([
    prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: {
          orderBy: { order: "desc" },
          include: {
            exercise: true,
            sets: {
              orderBy: { order: "asc" },
              include: { metrics: true },
            },
          },
        },
      },
    }),
    getExerciseSuggestions(),
  ]);

  if (!workout) {
    notFound();
  }

  const isActiveWorkout = !workout.endedAt;
  const canFinishWorkout = workout.exercises.length > 0 && workout.exercises.every((exercise) => exercise.sets.length > 0);
  const showFinishError = isActiveWorkout && finishError === "missingEntries";
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
              <p className="text-sm font-semibold text-zinc-400"><WorkoutDate date={workout.startedAt} /></p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {workout.endedAt ? "Workout complete" : "Active workout"}
              </h1>
            </div>

            {isActiveWorkout ? (
              <form action={finishWorkout}>
                <button
                  className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  disabled={!canFinishWorkout}
                >
                  Finish
                </button>
              </form>
            ) : null}
          </div>

          {isActiveWorkout && !canFinishWorkout ? (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <p className="text-sm font-black text-amber-100">
                {showFinishError ? "Workout not finished." : "Finish locked for now."}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-100/80">
                Add at least one exercise and at least one entry for every exercise before finishing.
              </p>
            </div>
          ) : null}
        </header>

        {isActiveWorkout ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xl font-black">Add exercise</h2>
            <AddExerciseForm action={addExercise} suggestions={exerciseSuggestions} />
          </section>
        ) : (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xl font-black">Workout locked</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-400">
              Completed workouts are read-only so the recorded history stays intact.
            </p>
          </section>
        )}

        {workout.exercises.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="font-black text-zinc-200">No exercises yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              {isActiveWorkout ? "Add your first movement and log an entry before finishing." : "This workout has no exercises."}
            </p>
          </section>
        ) : (
          workout.exercises.map((entry) => {
            const addSet = addSetAction.bind(null, workout.id, entry.id);
            const removeExercise = removeWorkoutExerciseAction.bind(null, workout.id, entry.id);
            const updateExerciseName = updateWorkoutExerciseNameAction.bind(null, workout.id, entry.id);
            const needsEntry = isActiveWorkout && entry.sets.length === 0;

            return (
              <section
                key={entry.id}
                id={`exercise-${entry.id}`}
                className={`rounded-3xl border bg-zinc-900 p-5 shadow-xl shadow-black/10 ${
                  needsEntry ? "border-amber-300/50" : "border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                      Exercise {entry.order + 1}
                    </p>
                    {isActiveWorkout ? (
                      <ExerciseNameEditor name={entry.exercise.name} action={updateExerciseName} />
                    ) : (
                      <h2 className="mt-2 text-2xl font-black">{entry.exercise.name}</h2>
                    )}
                  </div>

                  {isActiveWorkout ? (
                    <form action={removeExercise}>
                      <button className="rounded-full border border-red-400/40 px-3 py-2 text-sm font-bold text-red-200">
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>

                {needsEntry ? (
                  <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">
                    Add at least one entry for this exercise before finishing.
                  </p>
                ) : null}

                {entry.sets.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    {entry.sets.map((set) => {
                      const deleteSet = deleteSetAction.bind(null, workout.id, set.id);
                      const updateSet = updateSetAction.bind(null, workout.id, set.id);
                      const summary = set.metrics.map(formatMetric).join(" · ");

                      return isActiveWorkout ? (
                        <SetEntryEditor
                          key={set.id}
                          label={`Set ${set.order + 1}`}
                          summary={summary}
                          metrics={set.metrics.map((item) => ({
                            type: item.type,
                            unit: item.unit,
                            value: formatMetricValue(item.value),
                          }))}
                          updateAction={updateSet}
                          deleteAction={deleteSet}
                        />
                      ) : (
                        <div key={set.id} className="rounded-2xl bg-zinc-950 p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Set {set.order + 1}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-200">{summary}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {isActiveWorkout ? (
                  <form action={addSet} className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="mb-3 text-sm font-black text-zinc-300">Quick add set</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        autoFocus={entry.id === focusedExerciseId}
                        className="metric-input"
                        name="reps"
                        inputMode="decimal"
                        placeholder="Reps"
                      />
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
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
