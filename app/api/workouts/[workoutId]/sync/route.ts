import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkoutSnapshot } from "@/lib/workout-snapshot";
import type { OfflineMetric, OfflineWorkoutOperation } from "@/lib/workout-sync-types";

type RouteContext = {
  params: Promise<{ workoutId: string }>;
};

function metricData(setId: string, metrics: OfflineMetric[]) {
  return metrics.map((metric) => ({
    setId,
    type: metric.type,
    unit: metric.unit,
    value: metric.value,
  }));
}

function validDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function activeWorkoutExists(workoutId: string, userId: string) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { endedAt: true, userId: true },
  });

  return workout?.userId === userId && workout.endedAt === null;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();

  const { workoutId } = await context.params;
  const body = (await request.json()) as { operations?: OfflineWorkoutOperation[] };
  const operations = body.operations ?? [];
  const idMap = new Map<string, string>();

  if (!(await activeWorkoutExists(workoutId, user.id))) {
    return NextResponse.json({ snapshot: await getWorkoutSnapshot(workoutId, user.id) });
  }

  for (const operation of operations) {
    if (!(await activeWorkoutExists(workoutId, user.id))) {
      break;
    }

    if (operation.type === "addExercise") {
      const name = operation.payload.name.trim();

      if (!name) continue;

      const exercise = await prisma.exercise.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      const lastExercise = await prisma.workoutExercise.findFirst({
        where: { workoutId },
        orderBy: { order: "desc" },
      });
      const workoutExercise = await prisma.workoutExercise.create({
        data: {
          workoutId,
          exerciseId: exercise.id,
          order: (lastExercise?.order ?? -1) + 1,
        },
      });

      idMap.set(operation.payload.tempWorkoutExerciseId, workoutExercise.id);
    }

    if (operation.type === "removeExercise") {
      const workoutExerciseId = idMap.get(operation.payload.workoutExerciseId) ?? operation.payload.workoutExerciseId;

      await prisma.workoutExercise.deleteMany({ where: { id: workoutExerciseId, workoutId } });
    }

    if (operation.type === "updateExerciseName") {
      const workoutExerciseId = idMap.get(operation.payload.workoutExerciseId) ?? operation.payload.workoutExerciseId;
      const name = operation.payload.name.trim();

      if (!name) continue;

      const workoutExercise = await prisma.workoutExercise.findUnique({
        where: { id: workoutExerciseId },
        include: { exercise: true },
      });

      if (!workoutExercise || workoutExercise.workoutId !== workoutId) continue;

      const exercise = await prisma.exercise.upsert({
        where: { name },
        update: {},
        create: { name },
      });

      await prisma.workoutExercise.update({
        where: { id: workoutExerciseId },
        data: { exerciseId: exercise.id },
      });
    }

    if (operation.type === "updateWorkoutStartedAt") {
      const startedAt = validDate(operation.payload.startedAt);

      if (!startedAt) continue;

      await prisma.workout.updateMany({
        where: { id: workoutId, userId: user.id, endedAt: null },
        data: { startedAt },
      });

      revalidatePath("/");
      revalidatePath(`/workouts/${workoutId}`);
    }

    if (operation.type === "addSet") {
      const workoutExerciseId = idMap.get(operation.payload.workoutExerciseId) ?? operation.payload.workoutExerciseId;

      if (operation.payload.metrics.length === 0) continue;

      const workoutExercise = await prisma.workoutExercise.findUnique({ where: { id: workoutExerciseId } });

      if (!workoutExercise || workoutExercise.workoutId !== workoutId) continue;

      const lastSet = await prisma.exerciseSet.findFirst({
        where: { workoutExerciseId },
        orderBy: { order: "desc" },
      });
      const set = await prisma.exerciseSet.create({
        data: {
          workoutExerciseId,
          order: (lastSet?.order ?? -1) + 1,
          metrics: { create: operation.payload.metrics },
        },
      });

      idMap.set(operation.payload.tempSetId, set.id);
    }

    if (operation.type === "updateSet") {
      const setId = idMap.get(operation.payload.setId) ?? operation.payload.setId;

      if (operation.payload.metrics.length === 0) continue;

      const set = await prisma.exerciseSet.findUnique({
        where: { id: setId },
        include: { workoutExercise: { select: { workoutId: true } } },
      });

      if (!set || set.workoutExercise.workoutId !== workoutId) continue;

      await prisma.$transaction([
        prisma.setMetric.deleteMany({ where: { setId } }),
        prisma.setMetric.createMany({ data: metricData(setId, operation.payload.metrics) }),
      ]);
    }

    if (operation.type === "deleteSet") {
      const setId = idMap.get(operation.payload.setId) ?? operation.payload.setId;
      const set = await prisma.exerciseSet.findUnique({
        where: { id: setId },
        include: { workoutExercise: { select: { workoutId: true } } },
      });

      if (!set || set.workoutExercise.workoutId !== workoutId) continue;

      await prisma.exerciseSet.delete({ where: { id: setId } });
    }

    if (operation.type === "finishWorkout") {
      const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        select: { userId: true, exercises: { select: { sets: { select: { id: true } } } } },
      });
      const canFinish = workout?.userId === user.id && workout.exercises.length > 0 && workout.exercises.every((exercise) => exercise.sets.length > 0);

      if (canFinish) {
        await prisma.workout.updateMany({
          where: { id: workoutId, userId: user.id, endedAt: null },
          data: { endedAt: new Date() },
        });
      }
    }
  }

  return NextResponse.json({ snapshot: await getWorkoutSnapshot(workoutId, user.id) });
}
