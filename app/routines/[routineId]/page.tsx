import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { RoutineBuilder } from "@/app/routines/routine-builder";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExerciseSuggestions } from "@/lib/workout-suggestions-query";

export const dynamic = "force-dynamic";

type RoutinePageProps = {
  params: Promise<{ routineId: string }>;
};

export default async function EditRoutinePage({ params }: RoutinePageProps) {
  if (isDemoMode()) {
    redirect("/");
  }

  const { routineId } = await params;
  const user = await requireUser();
  const [routine, suggestions] = await Promise.all([
    prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { exercise: true },
        },
      },
    }),
    getExerciseSuggestions(user.id),
  ]);

  if (!routine || routine.userId !== user.id) {
    notFound();
  }

  return (
    <RoutineBuilder
      suggestions={suggestions}
      routine={{
        id: routine.id,
        name: routine.name,
        note: routine.note,
        items: routine.items.map((item) => ({
          name: item.exercise.name,
          variant: item.variant,
          target: item.target,
        })),
      }}
    />
  );
}
