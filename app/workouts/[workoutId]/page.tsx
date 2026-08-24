import { notFound } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { DemoWorkoutClient } from "@/app/workouts/[workoutId]/demo-workout-client";
import { OfflineWorkoutClient } from "@/app/workouts/[workoutId]/offline-workout-client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExerciseSuggestions } from "@/lib/workout-suggestions-query";
import { serializeWorkoutSnapshot } from "@/lib/workout-snapshot";

export const dynamic = "force-dynamic";

type WorkoutPageProps = {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ focusExercise?: string | string[]; finishError?: string | string[] }>;
};

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

  return (
    <OfflineWorkoutClient
      initialSnapshot={serializeWorkoutSnapshot(workout)}
      suggestions={exerciseSuggestions}
      focusedExerciseId={focusedExerciseId}
      finishError={finishError}
    />
  );
}
