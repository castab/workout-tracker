import "server-only";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { WorkoutSnapshot } from "@/lib/workout-sync-types";

type WorkoutRow = NonNullable<Awaited<ReturnType<typeof getWorkoutRow>>>;

async function getWorkoutRow(workoutId: string) {
  return prisma.workout.findUnique({
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
  });
}

export function serializeWorkoutSnapshot(workout: WorkoutRow): WorkoutSnapshot {
  return {
    id: workout.id,
    startedAt: workout.startedAt.toISOString(),
    endedAt: workout.endedAt?.toISOString() ?? null,
    exercises: workout.exercises.map((entry) => ({
      id: entry.id,
      order: entry.order,
      exercise: { name: entry.exercise.name },
      sets: entry.sets.map((set) => ({
        id: set.id,
        order: set.order,
        metrics: set.metrics.map((metric) => ({
          type: metric.type,
          unit: metric.unit,
          value: metric.value.toString().replace(/\.00$/, ""),
        })),
      })),
    })),
  };
}

export async function getWorkoutSnapshot(workoutId: string) {
  const workout = await getWorkoutRow(workoutId);

  if (!workout) {
    notFound();
  }

  return serializeWorkoutSnapshot(workout);
}
