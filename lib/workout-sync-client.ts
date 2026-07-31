import type { OfflineWorkoutOperation, WorkoutSnapshot } from "@/lib/workout-sync-types";

export function applyWorkoutOperation(
  snapshot: WorkoutSnapshot,
  item: OfflineWorkoutOperation,
): WorkoutSnapshot {
  if (item.type === "addExercise") {
    if (snapshot.exercises.some((entry) => entry.id === item.payload.tempWorkoutExerciseId)) {
      return snapshot;
    }

    const nextOrder = Math.max(-1, ...snapshot.exercises.map((entry) => entry.order)) + 1;

    return {
      ...snapshot,
      exercises: [
        {
          id: item.payload.tempWorkoutExerciseId,
          order: nextOrder,
          variant: item.payload.variant ?? "",
          exercise: { name: item.payload.name },
          sets: [],
        },
        ...snapshot.exercises,
      ],
    };
  }

  if (item.type === "removeExercise") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.filter((entry) => entry.id !== item.payload.workoutExerciseId),
    };
  }

  if (item.type === "updateExerciseName") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.map((entry) =>
        entry.id === item.payload.workoutExerciseId
          ? { ...entry, exercise: { name: item.payload.name } }
          : entry,
      ),
    };
  }

  if (item.type === "updateExerciseVariant") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.map((entry) =>
        entry.id === item.payload.workoutExerciseId
          ? { ...entry, variant: item.payload.variant }
          : entry,
      ),
    };
  }

  if (item.type === "addSet") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.map((entry) => {
        if (entry.id !== item.payload.workoutExerciseId) return entry;
        if (entry.sets.some((set) => set.id === item.payload.tempSetId)) return entry;

        const nextOrder = Math.max(-1, ...entry.sets.map((set) => set.order)) + 1;

        return {
          ...entry,
          sets: [
            ...entry.sets,
            { id: item.payload.tempSetId, order: nextOrder, metrics: item.payload.metrics },
          ],
        };
      }),
    };
  }

  if (item.type === "updateSet") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.map((entry) => ({
        ...entry,
        sets: entry.sets.map((set) =>
          set.id === item.payload.setId ? { ...set, metrics: item.payload.metrics } : set,
        ),
      })),
    };
  }

  if (item.type === "deleteSet") {
    return {
      ...snapshot,
      exercises: snapshot.exercises.map((entry) => ({
        ...entry,
        sets: entry.sets.filter((set) => set.id !== item.payload.setId),
      })),
    };
  }

  if (item.type === "finishWorkout") {
    return { ...snapshot, endedAt: snapshot.endedAt ?? item.createdAt };
  }

  return snapshot;
}

export function overlayWorkoutOperations(
  snapshot: WorkoutSnapshot,
  operations: OfflineWorkoutOperation[],
) {
  return operations.reduce(applyWorkoutOperation, snapshot);
}

export function chooseWorkoutSnapshot(
  serverRenderedSnapshot: WorkoutSnapshot,
  cachedSnapshot: WorkoutSnapshot | undefined,
  pendingOperations: OfflineWorkoutOperation[],
) {
  const normalizedServerSnapshot = serverRenderedSnapshot.revision == null
    ? { ...serverRenderedSnapshot, revision: 0 }
    : serverRenderedSnapshot;

  if (!cachedSnapshot) return normalizedServerSnapshot;

  if (
    pendingOperations.length > 0 ||
    cachedSnapshot.revision > normalizedServerSnapshot.revision
  ) {
    return cachedSnapshot;
  }

  return normalizedServerSnapshot;
}
