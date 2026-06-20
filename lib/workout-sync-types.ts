export type OfflineMetric = {
  type: "REPS" | "WEIGHT" | "TIME" | "DISTANCE" | "LAPS";
  unit: "COUNT" | "LB" | "KG" | "SECONDS" | "MINUTES" | "METERS" | "KM" | "MILES" | "LAPS";
  value: string;
};

export type WorkoutSnapshot = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  exercises: {
    id: string;
    order: number;
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
      payload: { tempWorkoutExerciseId: string; name: string };
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
