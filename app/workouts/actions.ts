"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MetricType, MetricUnit } from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NewMetric = {
  type: MetricType;
  unit: MetricUnit;
  value: string | null;
};

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function metricValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value === "" ? null : value;
}

function metricUnit(formData: FormData, key: string, fallback: MetricUnit) {
  const unit = textValue(formData, key);
  return unit === "" ? fallback : (unit as MetricUnit);
}

async function isActiveWorkout(workoutId: string) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { endedAt: true },
  });

  return workout?.endedAt === null;
}

export async function createWorkoutAction() {
  await requireUser();

  const workout = await prisma.workout.create({ data: {} });
  redirect(`/workouts/${workout.id}`);
}

export async function finishWorkoutAction(workoutId: string) {
  await requireUser();

  await prisma.workout.updateMany({
    where: { id: workoutId, endedAt: null },
    data: { endedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath(`/workouts/${workoutId}`);
}

export async function addExerciseToWorkoutAction(
  workoutId: string,
  formData: FormData,
) {
  await requireUser();

  if (!(await isActiveWorkout(workoutId))) {
    return;
  }

  const name = textValue(formData, "name");

  if (!name) {
    return;
  }

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

  revalidatePath(`/workouts/${workoutId}`);
  redirect(`/workouts/${workoutId}?focusExercise=${workoutExercise.id}#exercise-${workoutExercise.id}`);
}

export async function removeWorkoutExerciseAction(
  workoutId: string,
  workoutExerciseId: string,
) {
  await requireUser();

  const workoutExercise = await prisma.workoutExercise.findUnique({
    where: { id: workoutExerciseId },
    include: { workout: { select: { endedAt: true } } },
  });

  if (!workoutExercise || workoutExercise.workoutId !== workoutId || workoutExercise.workout.endedAt) {
    return;
  }

  await prisma.workoutExercise.delete({ where: { id: workoutExerciseId } });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function updateWorkoutExerciseNameAction(
  workoutId: string,
  workoutExerciseId: string,
  formData: FormData,
) {
  await requireUser();

  const name = textValue(formData, "name");

  if (!name) {
    return;
  }

  const workoutExercise = await prisma.workoutExercise.findUnique({
    where: { id: workoutExerciseId },
    include: { exercise: true, workout: { select: { endedAt: true } } },
  });

  if (!workoutExercise || workoutExercise.workoutId !== workoutId || workoutExercise.workout.endedAt) {
    return;
  }

  if (workoutExercise.exercise.name === name) {
    return;
  }

  const existingExercise = await prisma.exercise.findUnique({ where: { name } });

  if (existingExercise) {
    await prisma.workoutExercise.update({
      where: { id: workoutExerciseId },
      data: { exerciseId: existingExercise.id },
    });
  } else {
    const usageCount = await prisma.workoutExercise.count({
      where: { exerciseId: workoutExercise.exerciseId },
    });

    if (usageCount === 1) {
      await prisma.exercise.update({
        where: { id: workoutExercise.exerciseId },
        data: { name },
      });
    } else {
      const exercise = await prisma.exercise.create({ data: { name } });

      await prisma.workoutExercise.update({
        where: { id: workoutExerciseId },
        data: { exerciseId: exercise.id },
      });
    }
  }

  revalidatePath(`/workouts/${workoutId}`);
}

export async function addSetAction(workoutId: string, workoutExerciseId: string, formData: FormData) {
  await requireUser();

  const workoutExercise = await prisma.workoutExercise.findUnique({
    where: { id: workoutExerciseId },
    include: { workout: { select: { endedAt: true } } },
  });

  if (!workoutExercise || workoutExercise.workoutId !== workoutId || workoutExercise.workout.endedAt) {
    return;
  }

  const metrics: NewMetric[] = [
    { type: "REPS" as const, unit: "COUNT" as const, value: metricValue(formData, "reps") },
    { type: "WEIGHT" as const, unit: metricUnit(formData, "weightUnit", "LB"), value: metricValue(formData, "weight") },
    { type: "TIME" as const, unit: metricUnit(formData, "timeUnit", "MINUTES"), value: metricValue(formData, "time") },
    { type: "DISTANCE" as const, unit: metricUnit(formData, "distanceUnit", "MILES"), value: metricValue(formData, "distance") },
    { type: "LAPS" as const, unit: "LAPS" as const, value: metricValue(formData, "laps") },
  ].filter((metric) => metric.value !== null);

  if (metrics.length === 0) {
    return;
  }

  const lastSet = await prisma.exerciseSet.findFirst({
    where: { workoutExerciseId },
    orderBy: { order: "desc" },
  });

  await prisma.exerciseSet.create({
    data: {
      workoutExerciseId,
      order: (lastSet?.order ?? -1) + 1,
      metrics: {
        create: metrics.map((metric) => ({
          type: metric.type,
          unit: metric.unit,
          value: metric.value!,
        })),
      },
    },
  });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function deleteSetAction(workoutId: string, setId: string) {
  await requireUser();

  const set = await prisma.exerciseSet.findUnique({
    where: { id: setId },
    include: {
      workoutExercise: {
        select: {
          workoutId: true,
          workout: { select: { endedAt: true } },
        },
      },
    },
  });

  if (!set || set.workoutExercise.workoutId !== workoutId || set.workoutExercise.workout.endedAt) {
    return;
  }

  await prisma.exerciseSet.delete({ where: { id: setId } });

  revalidatePath(`/workouts/${workoutId}`);
}
