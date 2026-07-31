import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWorkoutOperation,
  chooseWorkoutSnapshot,
  overlayWorkoutOperations,
} from "../lib/workout-sync-client";
import type { OfflineWorkoutOperation, WorkoutSnapshot } from "../lib/workout-sync-types";

function snapshot(revision: number, setIds: string[] = []): WorkoutSnapshot {
  return {
    id: "workout-one",
    revision,
    startedAt: "2026-07-30T18:00:00.000Z",
    endedAt: null,
    exercises: [
      {
        id: "exercise-one",
        order: 0,
        variant: "",
        exercise: { name: "Bench press" },
        sets: setIds.map((id, order) => ({
          id,
          order,
          metrics: [{ type: "REPS", unit: "COUNT", value: "5" }],
        })),
      },
    ],
  };
}

function addSet(id: string, createdAt = "2026-07-30T18:01:00.000Z"): OfflineWorkoutOperation {
  return {
    id: `operation-${id}`,
    type: "addSet",
    createdAt,
    payload: {
      tempSetId: id,
      workoutExerciseId: "exercise-one",
      metrics: [{ type: "REPS", unit: "COUNT", value: "5" }],
    },
  };
}

test("a newer IndexedDB snapshot wins over a stale rendered document", () => {
  const rendered = snapshot(3, ["set-one"]);
  const cached = snapshot(4, ["set-one", "set-two"]);

  assert.equal(chooseWorkoutSnapshot(rendered, cached, []), cached);
});

test("the rendered snapshot wins on an equal revision when nothing is pending", () => {
  const rendered = snapshot(4, ["server-set"]);
  const cached = snapshot(4, ["old-cached-set"]);

  assert.equal(chooseWorkoutSnapshot(rendered, cached, []), rendered);
});

test("a cached optimistic snapshot wins while operations are pending", () => {
  const rendered = snapshot(5, ["server-set"]);
  const cached = snapshot(4, ["server-set", "local-set"]);

  assert.equal(chooseWorkoutSnapshot(rendered, cached, [addSet("local-set")]), cached);
});

test("replaying an add-set operation is idempotent", () => {
  const operation = addSet("stable-set-id");
  const once = applyWorkoutOperation(snapshot(1), operation);
  const twice = applyWorkoutOperation(once, operation);

  assert.deepEqual(twice, once);
  assert.deepEqual(twice.exercises[0].sets.map((set) => set.id), ["stable-set-id"]);
});

test("operations queued during a request overlay the returned server snapshot", () => {
  const server = snapshot(7, ["acknowledged-set"]);
  const localOperation = addSet("queued-while-syncing");
  const reconciled = overlayWorkoutOperations(server, [localOperation]);

  assert.equal(reconciled.revision, 7);
  assert.deepEqual(
    reconciled.exercises[0].sets.map((set) => set.id),
    ["acknowledged-set", "queued-while-syncing"],
  );
});
