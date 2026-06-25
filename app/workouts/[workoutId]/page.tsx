import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { LocalDateTime } from "@/app/local-date-time";
import type { ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import { DemoWorkoutClient } from "@/app/workouts/[workoutId]/demo-workout-client";
import { OfflineWorkoutClient } from "@/app/workouts/[workoutId]/offline-workout-client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeWorkoutSnapshot } from "@/lib/workout-snapshot";

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

type StartingWeight = ExerciseSuggestion["startingWeights"][number];

const weightUnits: StartingWeight["unit"][] = ["LB", "KG"];

function isWeightUnit(unit: string): unit is StartingWeight["unit"] {
  return weightUnits.includes(unit as StartingWeight["unit"]);
}

async function getExerciseSuggestions(userId: string): Promise<ExerciseSuggestion[]> {
  const suggestions = await prisma.$queryRaw<ExerciseSuggestionRow[]>`
    SELECT
      e.id,
      e.name,
      COUNT(*)::int AS "usageCount",
      MAX(we."createdAt") AS "lastUsedAt"
    FROM "WorkoutExercise" we
    JOIN "Exercise" e ON e.id = we."exerciseId"
    JOIN "Workout" w ON w.id = we."workoutId"
    WHERE we."createdAt" >= NOW() - INTERVAL '90 days'
      AND w."userId" = ${userId}
    GROUP BY e.id, e.name
    ORDER BY COUNT(*) DESC, MAX(we."createdAt") DESC, e.name ASC
    LIMIT 50
  `;

  const exerciseIds = suggestions.map((suggestion) => suggestion.id);

  if (exerciseIds.length === 0) {
    return [];
  }

  const startingWeightRows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: {
        userId,
        endedAt: { not: null },
      },
      sets: {
        some: {
          metrics: {
            some: {
              type: "WEIGHT",
              unit: { in: weightUnits },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      sets: {
        orderBy: { order: "asc" },
        include: {
          metrics: {
            where: {
              type: "WEIGHT",
              unit: { in: weightUnits },
            },
          },
        },
      },
    },
  });

  const startingWeightsByExerciseId = new Map<string, StartingWeight[]>();
  const seenExerciseVariants = new Set<string>();

  for (const entry of startingWeightRows) {
    const firstWeightMetric = entry.sets
      .flatMap((set) => set.metrics)
      .find((metric) => isWeightUnit(metric.unit));

    if (!firstWeightMetric) continue;

    const weightUnit = firstWeightMetric.unit;

    if (!isWeightUnit(weightUnit)) continue;

    const variant = entry.variant.trim();
    const key = `${entry.exerciseId}:${variant.toLowerCase()}`;

    if (seenExerciseVariants.has(key)) continue;

    seenExerciseVariants.add(key);

    const startingWeights = startingWeightsByExerciseId.get(entry.exerciseId) ?? [];

    startingWeights.push({
      value: formatMetricValue(firstWeightMetric.value),
      unit: weightUnit,
      variant,
      lastUsedAt: entry.createdAt.toISOString(),
    });

    startingWeightsByExerciseId.set(entry.exerciseId, startingWeights);
  }

  return suggestions.map((suggestion) => ({
    ...suggestion,
    lastUsedAt: suggestion.lastUsedAt.toISOString(),
    startingWeights: startingWeightsByExerciseId.get(suggestion.id) ?? [],
  }));
}

export default async function WorkoutPage({ params, searchParams }: WorkoutPageProps) {
  const { workoutId } = await params;

  if (isDemoMode()) {
    return <DemoWorkoutClient workoutId={workoutId} />;
  }

  const user = await requireUser();

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
    getExerciseSuggestions(user.id),
  ]);

  if (!workout || workout.userId !== user.id) {
    notFound();
  }

  const isActiveWorkout = !workout.endedAt;
  const canFinishWorkout = workout.exercises.length > 0 && workout.exercises.every((exercise) => exercise.sets.length > 0);
  const showFinishError = isActiveWorkout && finishError === "missingEntries";

  if (isActiveWorkout) {
    return (
      <OfflineWorkoutClient
        initialSnapshot={serializeWorkoutSnapshot(workout)}
        suggestions={exerciseSuggestions}
        focusedExerciseId={focusedExerciseId}
        finishError={finishError}
      />
    );
  }

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

            {isActiveWorkout ? null : null}
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

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Workout locked</h2>
          <p className="mt-2 text-sm font-semibold text-zinc-400">
            Completed workouts are read-only so the recorded history stays intact.
          </p>
        </section>

        {workout.exercises.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="font-black text-zinc-200">No exercises yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              This workout has no exercises.
            </p>
          </section>
        ) : (
          workout.exercises.map((entry) => {
            const needsEntry = false;

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
                    <h2 className="mt-2 text-2xl font-black">{entry.exercise.name}</h2>
                    {entry.variant ? (
                      <p className="mt-2 text-sm font-bold text-zinc-300">{entry.variant}</p>
                    ) : null}
                  </div>

                  {isActiveWorkout ? null : null}
                </div>

                {needsEntry ? (
                  <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">
                    Add at least one entry for this exercise before finishing.
                  </p>
                ) : null}

                {entry.sets.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    {entry.sets.map((set) => {
                      const summary = set.metrics.map(formatMetric).join(" · ");

                      return (
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

                {isActiveWorkout ? null : null}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
