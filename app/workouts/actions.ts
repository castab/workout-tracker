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

export async function createWorkoutAction() {
  await requireUser();

  const workout = await prisma.workout.create({ data: {} });
  redirect(`/workouts/${workout.id}`);
}

export async function finishWorkoutAction(workoutId: string) {
  await requireUser();

  await prisma.workout.update({
    where: { id: workoutId },
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

  await prisma.workoutExercise.delete({ where: { id: workoutExerciseId } });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function addSetAction(workoutId: string, workoutExerciseId: string, formData: FormData) {
  await requireUser();

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

  await prisma.exerciseSet.delete({ where: { id: setId } });

  revalidatePath(`/workouts/${workoutId}`);
}
