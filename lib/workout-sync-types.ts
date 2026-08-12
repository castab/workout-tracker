export type OfflineMetric = {
  type: "REPS" | "WEIGHT" | "TIME" | "DISTANCE" | "LAPS";
  unit: "COUNT" | "LB" | "KG" | "SECONDS" | "MINUTES" | "METERS" | "KM" | "MILES" | "LAPS";
  value: string;
};

export type WorkoutPlanItem = {
  id: string;
  order: number;
  name: string;
  variant: string;
  /** Free text, display only: "4 × 6-8". */
  target: string;
};

/**
 * The routine this workout was started from, copied at start. Immutable for the
 * life of the workout, so no sync operation ever touches it.
 */
export type WorkoutPlan = {
  routineId: string | null;
  name: string;
  items: WorkoutPlanItem[];
};

export type WorkoutSnapshot = {
  id: string;
  revision: number;
  startedAt: string;
  endedAt: string | null;
  /**
   * Optional because snapshots cached in IndexedDB by earlier builds have no
   * `plan` key. `chooseWorkoutSnapshot` normalizes it to null on read.
   */
  plan?: WorkoutPlan | null;
  exercises: {
    id: string;
    order: number;
    variant: string;
    exercise: { name: string };
    sets: {
      id: string;
      order: number;
      metrics: OfflineMetric[];
    }[];
  }[];
};

export type OfflineWorkoutOperation =
  | {
      id: string;
      type: "addExercise";
      createdAt: string;
      payload: { tempWorkoutExerciseId: string; name: string; variant: string };
    }
  | {
      id: string;
      type: "removeExercise";
      createdAt: string;
      payload: { workoutExerciseId: string };
    }
  | {
      id: string;
      type: "updateExerciseName";
      createdAt: string;
      payload: { workoutExerciseId: string; name: string };
    }
  | {
      id: string;
      type: "updateExerciseVariant";
      createdAt: string;
      payload: { workoutExerciseId: string; variant: string };
    }
  | {
      id: string;
      type: "addSet";
      createdAt: string;
      payload: { tempSetId: string; workoutExerciseId: string; metrics: OfflineMetric[] };
    }
  | {
      id: string;
      type: "updateSet";
      createdAt: string;
      payload: { setId: string; metrics: OfflineMetric[] };
    }
  | {
      id: string;
      type: "deleteSet";
      createdAt: string;
      payload: { setId: string };
    }
  | {
      id: string;
      type: "finishWorkout";
      createdAt: string;
      payload: Record<string, never>;
    };
