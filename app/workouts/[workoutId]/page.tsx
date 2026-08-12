import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { LocalDateTime } from "@/app/local-date-time";
import { DemoWorkoutClient } from "@/app/workouts/[workoutId]/demo-workout-client";
import { OfflineWorkoutClient } from "@/app/workouts/[workoutId]/offline-workout-client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatSetSummary } from "@/lib/workout-metrics";
import { getExerciseSuggestions } from "@/lib/workout-suggestions-query";
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
        planItems: {
          orderBy: { order: "asc" },
          include: { exercise: true },
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
            {workout.planName ? (
              <p
                className="mt-2 text-xs font-bold uppercase"
                style={{ letterSpacing: "var(--tracking-eyebrow-sm)", color: "var(--text-accent)" }}
              >
                Plan · {workout.planName}
              </p>
            ) : null}
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
