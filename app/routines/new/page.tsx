import { redirect } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { RoutineBuilder } from "@/app/routines/routine-builder";
import { requireUser } from "@/lib/auth";
import { getExerciseSuggestions } from "@/lib/workout-suggestions-query";

export const dynamic = "force-dynamic";

export default async function NewRoutinePage() {
  // Routines are server-backed, so there is nothing this screen can do in the
  // browser-only preview build.
  if (isDemoMode()) {
    redirect("/");
  }

  const user = await requireUser();
  const suggestions = await getExerciseSuggestions(user.id);

  return <RoutineBuilder suggestions={suggestions} />;
}
