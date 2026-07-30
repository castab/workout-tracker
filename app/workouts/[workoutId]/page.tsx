import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { LocalDateTime } from "@/app/local-date-time";
import { DemoWorkoutClient } from "@/app/workouts/[workoutId]/demo-workout-client";
import { OfflineWorkoutClient } from "@/app/workouts/[workoutId]/offline-workout-client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deriveMode,
  formatMetricValue,
  formatSetCompact,
  formatSetSummary,
} from "@/lib/workout-metrics";
import {
  type ExerciseSuggestion,
  type LastSession,
  type StartingWeight,
  isWeightUnit,
} from "@/lib/workout-suggestions";
import type { OfflineMetric } from "@/lib/workout-sync-types";
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

type ExerciseSuggestionRow = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: Date;
};

async function getExerciseSuggestions(userId: string, workoutId: string): Promise<ExerciseSuggestion[]> {
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
      AND w.id <> ${workoutId}
    GROUP BY e.id, e.name
    ORDER BY COUNT(*) DESC, MAX(we."createdAt") DESC, e.name ASC
    LIMIT 50
  `;

  const exerciseIds = suggestions.map((suggestion) => suggestion.id);

  if (exerciseIds.length === 0) {
    return [];
  }

  // One pass feeds both outputs: the starting-weight hints (deduped per
  // exercise+variant) and the "Last time" line (deduped per exercise).
  const historyRows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: {
        userId,
        id: { not: workoutId },
      },
      sets: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      sets: {
        orderBy: { order: "asc" },
        include: { metrics: true },
      },
    },
  });

  const startingWeightsByExerciseId = new Map<string, StartingWeight[]>();
  const lastSessionByExerciseId = new Map<string, LastSession>();
  const seenExerciseVariants = new Set<string>();

  for (const entry of historyRows) {
    const metricsBySet: OfflineMetric[][] = entry.sets.map((set) =>
      set.metrics.map((item) => ({
        type: item.type,
        unit: item.unit,
        value: formatMetricValue(item.value),
      })),
    );

    // Rows are ordered newest-first, so the first hit per exercise is the most recent.
    if (!lastSessionByExerciseId.has(entry.exerciseId) && metricsBySet.length > 0) {
      lastSessionByExerciseId.set(entry.exerciseId, {
        performedAt: entry.createdAt.toISOString(),
        mode: deriveMode(metricsBySet[metricsBySet.length - 1]),
        setSummaries: metricsBySet.map(formatSetCompact).filter(Boolean),
      });
    }

    const firstWeightMetric = metricsBySet
      .flat()
      .find((item) => item.type === "WEIGHT" && isWeightUnit(item.unit));

    if (!firstWeightMetric || !isWeightUnit(firstWeightMetric.unit)) continue;

    const variant = entry.variant.trim();
    const key = `${entry.exerciseId}:${variant.toLowerCase()}`;

    if (seenExerciseVariants.has(key)) continue;

    seenExerciseVariants.add(key);

    const startingWeights = startingWeightsByExerciseId.get(entry.exerciseId) ?? [];

    startingWeights.push({
      value: firstWeightMetric.value,
      unit: firstWeightMetric.unit,
      variant,
      lastUsedAt: entry.createdAt.toISOString(),
    });

    startingWeightsByExerciseId.set(entry.exerciseId, startingWeights);
  }

  return suggestions.map((suggestion) => ({
    ...suggestion,
    lastUsedAt: suggestion.lastUsedAt.toISOString(),
    startingWeights: startingWeightsByExerciseId.get(suggestion.id) ?? [],
    lastSession: lastSessionByExerciseId.get(suggestion.id) ?? null,
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
    getExerciseSuggestions(user.id, workoutId),
  ]);

  if (!workout || workout.userId !== user.id) {
    notFound();
  }

  if (!workout.endedAt) {
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
    <main
      className="min-h-screen text-zinc-50"
      style={{ background: "var(--surface-app)", padding: "var(--page-py) var(--page-px)" }}
    >
      <div className="mx-auto flex w-full flex-col" style={{ maxWidth: "var(--content-max)", gap: "var(--stack-gap)" }}>
        <header
          className="border p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            borderColor: "var(--border-default)",
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Link href="/" className="text-sm font-bold" style={{ color: "var(--text-accent)" }}>
            ← Back to workouts
          </Link>

          <div className="mt-5">
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              <WorkoutDate date={workout.startedAt} />
            </p>
            <h1 className="mt-2" style={{ font: "var(--type-display)", letterSpacing: "var(--tracking-tight)" }}>
              Workout complete
            </h1>
          </div>
        </header>

        <section
          className="border p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            borderColor: "var(--border-default)",
            background: "var(--surface-card)",
          }}
        >
          <h2 style={{ font: "var(--type-section)" }}>Workout locked</h2>
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Completed workouts are read-only so the recorded history stays intact.
          </p>
        </section>

        {workout.exercises.length === 0 ? (
          <section
            className="border border-dashed p-8 text-center"
            style={{ borderRadius: "var(--radius-xl)", borderColor: "var(--border-strong)" }}
          >
            <p className="font-black" style={{ color: "var(--text-secondary)" }}>No exercises yet.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
              This workout has no exercises.
            </p>
          </section>
        ) : (
          workout.exercises.map((entry) => (
            <section
              key={entry.id}
              id={`exercise-${entry.id}`}
              className="border p-5"
              style={{
                borderRadius: "var(--radius-xl)",
                borderColor: "var(--border-default)",
                background: "var(--surface-card)",
                boxShadow: "var(--shadow-card-soft)",
              }}
            >
              <p
                className="text-xs font-bold uppercase"
                style={{ letterSpacing: "var(--tracking-eyebrow)", color: "var(--text-faint)" }}
              >
                Exercise {entry.order + 1}
              </p>
              <h2 className="mt-2" style={{ font: "var(--type-exercise)", letterSpacing: "var(--tracking-tight)" }}>
                {entry.exercise.name}
              </h2>
              {entry.variant ? (
                <p className="mt-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>{entry.variant}</p>
              ) : null}

              {entry.sets.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {entry.sets.map((set) => (
                    <div key={set.id} className="p-3" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)" }}>
                      <p
                        className="text-xs font-bold uppercase"
                        style={{ letterSpacing: "var(--tracking-eyebrow-sm)", color: "var(--text-faint)" }}
                      >
                        Set {set.order + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {formatSetSummary(set.metrics)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))
        )}
      </div>
    </main>
  );
}
