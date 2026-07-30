"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The only server action left on this route. Every other workout mutation goes
 * through the offline queue in app/workouts/[workoutId]/offline-workout-client.tsx
 * and is applied by app/api/workouts/[workoutId]/sync/route.ts, which is the
 * single source of truth for how an operation is persisted.
 */
export async function createWorkoutAction() {
  const user = await requireUser();

  const workout = await prisma.workout.create({ data: { userId: user.id } });
  redirect(`/workouts/${workout.id}`);
}
