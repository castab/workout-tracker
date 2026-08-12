"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export type RoutineItemInput = {
  name: string;
  variant: string;
  target: string;
};

export type RoutineInput = {
  id?: string;
  name: string;
  note: string;
  items: RoutineItemInput[];
};

const maxRoutineItems = 40;

/**
 * Trims, drops blanks, and dedupes by name. Two rows for the same exercise would
 * make the plan panel's name matching ambiguous, and the routine is a checklist —
 * a repeated line has nothing to say that one line does not.
 */
function normalizeItems(items: RoutineItemInput[]) {
  const seen = new Set<string>();

  return items
    .map((item) => ({
      name: item.name.trim(),
      variant: item.variant.trim(),
      target: item.target.trim(),
    }))
    .filter((item) => {
      if (!item.name) return false;

      const key = item.name.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);

      return true;
    })
    .slice(0, maxRoutineItems);
}

async function upsertExerciseIds(tx: Prisma.TransactionClient, names: string[]) {
  const ids = new Map<string, string>();

  for (const name of names) {
    const exercise = await tx.exercise.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    ids.set(name, exercise.id);
  }

  return ids;
}

/**
 * Creates or replaces a routine. Items are rewritten wholesale rather than
 * diffed: the builder always submits the full list, and `@@unique([routineId,
 * order])` makes an in-place reorder a constraint fight for no benefit.
 */
async function saveRoutine(input: RoutineInput): Promise<string> {
  const user = await requireUser();
  const name = input.name.trim() || "New routine";
  const note = input.note.trim();
  const items = normalizeItems(input.items);

  return prisma.$transaction(async (tx) => {
    const exerciseIds = await upsertExerciseIds(tx, items.map((item) => item.name));
    const itemData = items.map((item, index) => ({
      exerciseId: exerciseIds.get(item.name)!,
      order: index,
      variant: item.variant,
      target: item.target,
    }));

    if (input.id) {
      const existing = await tx.routine.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!existing || existing.userId !== user.id) {
        throw new Error("Routine not found.");
      }

      await tx.routineItem.deleteMany({ where: { routineId: input.id } });
      await tx.routine.update({
        where: { id: input.id },
        data: { name, note, items: { create: itemData } },
      });

      return input.id;
    }

    const routine = await tx.routine.create({
      data: { userId: user.id, name, note, items: { create: itemData } },
    });

    return routine.id;
  });
}

/** Copies the routine's items onto a fresh workout. See WorkoutPlanItem. */
async function startWorkoutFromRoutine(routineId: string): Promise<string> {
  const user = await requireUser();

  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.findUnique({
      where: { id: routineId },
      include: { items: { orderBy: { order: "asc" } } },
    });

    if (!routine || routine.userId !== user.id) {
      throw new Error("Routine not found.");
    }

    const workout = await tx.workout.create({
      data: {
        userId: user.id,
        routineId: routine.id,
        planName: routine.name,
        planItems: {
          create: routine.items.map((item) => ({
            exerciseId: item.exerciseId,
            order: item.order,
            variant: item.variant,
            target: item.target,
          })),
        },
      },
    });

    return workout.id;
  });
}

export async function saveRoutineAction(input: RoutineInput) {
  await saveRoutine(input);

  revalidatePath("/");
  redirect("/");
}

export async function saveAndStartRoutineAction(input: RoutineInput) {
  const routineId = await saveRoutine(input);
  const workoutId = await startWorkoutFromRoutine(routineId);

  revalidatePath("/");
  redirect(`/workouts/${workoutId}`);
}

export async function startRoutineWorkoutAction(routineId: string) {
  const workoutId = await startWorkoutFromRoutine(routineId);

  revalidatePath("/");
  redirect(`/workouts/${workoutId}`);
}

export async function deleteRoutineAction(routineId: string) {
  const user = await requireUser();

  // Past workouts keep their copied plan; Workout.routineId is set null by the FK.
  await prisma.routine.deleteMany({ where: { id: routineId, userId: user.id } });

  revalidatePath("/");
  redirect("/");
}
