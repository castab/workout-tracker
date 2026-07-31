import { NextResponse } from "next/server";
import { isDemoMode } from "@/app/demo-mode";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkoutSnapshot } from "@/lib/workout-snapshot";
import type { OfflineMetric, OfflineWorkoutOperation } from "@/lib/workout-sync-types";

type RouteContext = {
  params: Promise<{ workoutId: string }>;
};

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

function metricData(setId: string, metrics: OfflineMetric[]) {
  return metrics.map((metric) => ({
    setId,
    type: metric.type,
    unit: metric.unit,
    value: metric.value,
  }));
}

async function snapshotResponse(workoutId: string, userId: string) {
  return NextResponse.json(
    { snapshot: await getWorkoutSnapshot(workoutId, userId) },
    { headers: noStoreHeaders },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Sync is disabled in demo mode." }, { status: 404 });
  }

  const user = await requireUser();
  const { workoutId } = await context.params;

  return snapshotResponse(workoutId, user.id);
}

export async function POST(request: Request, context: RouteContext) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Sync is disabled in demo mode." }, { status: 404 });
  }

  const user = await requireUser();
  const { workoutId } = await context.params;
  const body = (await request.json()) as { operations?: OfflineWorkoutOperation[] };
  const operations = body.operations ?? [];

  if (operations.length === 0) {
    return snapshotResponse(workoutId, user.id);
  }

  await prisma.$transaction(
    async (tx) => {
      const workout = await tx.workout.findUnique({
        where: { id: workoutId },
        select: { endedAt: true, userId: true },
      });

      if (!workout || workout.userId !== user.id || workout.endedAt !== null) {
        return;
      }

      for (const operation of operations) {
      if (operation.type === "addExercise") {
        const name = operation.payload.name.trim();
        const variant = (operation.payload.variant ?? "").trim();

        if (!name) continue;

        const existingEntry = await tx.workoutExercise.findUnique({
          where: { id: operation.payload.tempWorkoutExerciseId },
          select: { workoutId: true },
        });

        if (existingEntry) {
          continue;
        }

        const exercise = await tx.exercise.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        const lastExercise = await tx.workoutExercise.findFirst({
          where: { workoutId },
          orderBy: { order: "desc" },
        });

        await tx.workoutExercise.create({
          data: {
            id: operation.payload.tempWorkoutExerciseId,
            workoutId,
            exerciseId: exercise.id,
            variant,
            order: (lastExercise?.order ?? -1) + 1,
          },
        });
      }

      if (operation.type === "removeExercise") {
        await tx.workoutExercise.deleteMany({
          where: { id: operation.payload.workoutExerciseId, workoutId },
        });
      }

      if (operation.type === "updateExerciseName") {
        const name = operation.payload.name.trim();

        if (!name) continue;

        const workoutExercise = await tx.workoutExercise.findUnique({
          where: { id: operation.payload.workoutExerciseId },
          select: { workoutId: true },
        });

        if (!workoutExercise || workoutExercise.workoutId !== workoutId) continue;

        const exercise = await tx.exercise.upsert({
          where: { name },
          update: {},
          create: { name },
        });

        await tx.workoutExercise.update({
          where: { id: operation.payload.workoutExerciseId },
          data: { exerciseId: exercise.id },
        });
      }

      if (operation.type === "updateExerciseVariant") {
        await tx.workoutExercise.updateMany({
          where: { id: operation.payload.workoutExerciseId, workoutId },
          data: { variant: operation.payload.variant.trim() },
        });
      }

      if (operation.type === "addSet") {
        if (operation.payload.metrics.length === 0) continue;

        const existingSet = await tx.exerciseSet.findUnique({
          where: { id: operation.payload.tempSetId },
          select: { workoutExercise: { select: { workoutId: true } } },
        });

        if (existingSet) {
          continue;
        }

        const workoutExercise = await tx.workoutExercise.findUnique({
          where: { id: operation.payload.workoutExerciseId },
          select: { workoutId: true },
        });

        if (!workoutExercise || workoutExercise.workoutId !== workoutId) continue;

        const lastSet = await tx.exerciseSet.findFirst({
          where: { workoutExerciseId: operation.payload.workoutExerciseId },
          orderBy: { order: "desc" },
        });

        await tx.exerciseSet.create({
          data: {
            id: operation.payload.tempSetId,
            workoutExerciseId: operation.payload.workoutExerciseId,
            order: (lastSet?.order ?? -1) + 1,
            metrics: { create: operation.payload.metrics },
          },
        });
      }

      if (operation.type === "updateSet") {
        if (operation.payload.metrics.length === 0) continue;

        const set = await tx.exerciseSet.findUnique({
          where: { id: operation.payload.setId },
          select: { workoutExercise: { select: { workoutId: true } } },
        });

        if (!set || set.workoutExercise.workoutId !== workoutId) continue;

        await tx.setMetric.deleteMany({ where: { setId: operation.payload.setId } });
        await tx.setMetric.createMany({
          data: metricData(operation.payload.setId, operation.payload.metrics),
        });
      }

      if (operation.type === "deleteSet") {
        const set = await tx.exerciseSet.findUnique({
          where: { id: operation.payload.setId },
          select: { workoutExercise: { select: { workoutId: true } } },
        });

        if (!set || set.workoutExercise.workoutId !== workoutId) continue;

        await tx.exerciseSet.delete({ where: { id: operation.payload.setId } });
      }

      if (operation.type === "finishWorkout") {
        const workoutToFinish = await tx.workout.findUnique({
          where: { id: workoutId },
          select: {
            userId: true,
            exercises: { select: { sets: { select: { id: true } } } },
          },
        });
        const canFinish =
          workoutToFinish?.userId === user.id &&
          workoutToFinish.exercises.length > 0 &&
          workoutToFinish.exercises.every((exercise) => exercise.sets.length > 0);

        if (canFinish) {
          await tx.workout.update({
            where: { id: workoutId },
            data: { endedAt: new Date() },
          });
          break;
        }
      }
      }

      await tx.workout.update({
        where: { id: workoutId },
        data: { revision: { increment: 1 } },
      });
    },
    { maxWait: 5_000, timeout: 15_000 },
  );

  return snapshotResponse(workoutId, user.id);
}
