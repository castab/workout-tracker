"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/app/material-icon";
import { AddExercisePanel } from "@/app/workouts/[workoutId]/add-exercise-panel";
import { CollapsedExerciseRow } from "@/app/workouts/[workoutId]/collapsed-exercise-row";
import { FocusExerciseCard } from "@/app/workouts/[workoutId]/focus-exercise-card";
import {
  addPendingOperation,
  clearPendingOperations,
  getCachedWorkoutSnapshot,
  getPendingOperations,
  saveWorkoutSnapshot,
} from "./offline-workout-store";
import { type ExerciseMode, deriveMode } from "@/lib/workout-metrics";
import { type ExerciseSuggestion, findSuggestion } from "@/lib/workout-suggestions";
import type { OfflineMetric, OfflineWorkoutOperation, WorkoutSnapshot } from "@/lib/workout-sync-types";

type OfflineWorkoutClientProps = {
  initialSnapshot: WorkoutSnapshot;
  suggestions: ExerciseSuggestion[];
  focusedExerciseId?: string;
  finishError?: string;
  syncMode?: "server" | "local";
};

type SyncState = "online" | "offline" | "syncing" | "error";

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function operation(type: OfflineWorkoutOperation["type"], payload: OfflineWorkoutOperation["payload"]) {
  return {
    id: createId("op"),
    type,
    createdAt: new Date().toISOString(),
    payload,
  } as OfflineWorkoutOperation;
}

function applyOperation(snapshot: WorkoutSnapshot, item: OfflineWorkoutOperation): WorkoutSnapshot {
  if (item.type === "addExercise") {
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
    return { ...snapshot, endedAt: new Date().toISOString() };
  }

  return snapshot;
}

function StatusBanner({ state, pendingCount }: { state: SyncState; pendingCount: number }) {
  if (state !== "offline") return null;

  const text = pendingCount > 0
    ? `Offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you're back online.`
    : "You're offline. Changes will sync automatically when you're back online.";

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-accent-soft)",
        background: "var(--accent-wash)",
        color: "var(--lime-100)",
        padding: "var(--space-3) var(--space-4)",
        font: "var(--type-body-strong)",
      }}
    >
      {text}
    </div>
  );
}

function SyncErrorToast({ pendingCount }: { pendingCount: number }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        display: "grid",
        placeItems: "center",
        padding: "0 var(--page-px)",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div
        role="alert"
        className="sync-error-toast"
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: "var(--content-max)",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-danger)",
          background: "var(--danger-wash)",
          color: "var(--text-danger)",
          padding: "var(--space-4)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)",
        }}
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          style={{ width: 24, height: 24, flexShrink: 0, marginTop: 1 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>

        <div style={{ flex: 1 }}>
          <strong style={{ display: "block", font: "var(--type-body-strong)", lineHeight: 1.2 }}>
            Sync failed
          </strong>
          <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)" }}>
            {pendingCount} change{pendingCount === 1 ? "" : "s"} couldn&apos;t be saved. We&apos;ll keep retrying automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export function OfflineWorkoutClient({
  initialSnapshot,
  suggestions,
  focusedExerciseId,
  finishError,
  syncMode = "server",
}: OfflineWorkoutClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pendingCount, setPendingCount] = useState(0);
  // Always "online" for the server render. Node 21+ defines a global `navigator`
  // with no `onLine` property, so probing it here resolved to "offline" and
  // server-rendered a "0 offline changes queued." banner that hydration then
  // removed. The mount effect calls syncPending(), which corrects the state.
  const [syncState, setSyncState] = useState<SyncState>("online");
  const [focusId, setFocusId] = useState<string | null>(focusedExerciseId ?? initialSnapshot.exercises[0]?.id ?? null);
  // Session-only. Mode is normally derived from the metrics already logged; this
  // records an explicit override so an empty exercise can be switched to cardio
  // before it has any metrics to derive from.
  const [modeOverrides, setModeOverrides] = useState<Record<string, ExerciseMode>>({});

  const canFinishWorkout = snapshot.exercises.length > 0 && snapshot.exercises.every((entry) => entry.sets.length > 0);

  const syncPending = useCallback(async () => {
    if (syncMode === "local") {
      setPendingCount(0);
      setSyncState("online");
      return;
    }

    if (!navigator.onLine) {
      setSyncState("offline");
      return;
    }

    const operations = await getPendingOperations(snapshot.id);
    setPendingCount(operations.length);

    if (operations.length === 0) {
      setSyncState("online");
      return;
    }

    setSyncState("syncing");

    try {
      const response = await fetch(`/api/workouts/${snapshot.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) throw new Error("Sync failed");

      const data = (await response.json()) as { snapshot: WorkoutSnapshot };

      await clearPendingOperations(snapshot.id);
      await saveWorkoutSnapshot(data.snapshot);
      setSnapshot(data.snapshot);
      setPendingCount(0);
      setSyncState("online");
    } catch {
      setSyncState("error");
    }
  }, [snapshot.id, syncMode]);

  async function queue(item: OfflineWorkoutOperation) {
    const nextSnapshot = applyOperation(snapshot, item);

    setSnapshot(nextSnapshot);
    await saveWorkoutSnapshot(nextSnapshot);

    if (syncMode === "local") {
      setPendingCount(0);
      setSyncState("online");
      return;
    }

    await addPendingOperation(snapshot.id, item);
    const operations = await getPendingOperations(snapshot.id);
    setPendingCount(operations.length);

    if (navigator.onLine) {
      await syncPending();
    } else {
      setSyncState("offline");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const cached = await getCachedWorkoutSnapshot(initialSnapshot.id);
      const operations = await getPendingOperations(initialSnapshot.id);

      if (!isMounted) return;

      if (cached && operations.length > 0) {
        setSnapshot(cached);
      } else {
        await saveWorkoutSnapshot(initialSnapshot);
      }

      setPendingCount(operations.length);
      void syncPending();
    }

    function handleOnline() {
      void syncPending();
    }

    function handleOffline() {
      setSyncState("offline");
    }

    function handlePageShow() {
      void syncPending();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void syncPending();
    }

    void load();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialSnapshot, syncPending]);

  useEffect(() => {
    if (syncState !== "error") return;

    const retry = setInterval(() => {
      void syncPending();
    }, 20_000);

    return () => clearInterval(retry);
  }, [syncState, syncPending]);

  // The focused exercise can vanish when a sync replaces the snapshot (temp ids
  // become real ones) or when it is deleted. Fall back to the first exercise.
  const focusIndex = snapshot.exercises.findIndex((entry) => entry.id === focusId);
  const focusEntry = focusIndex >= 0 ? snapshot.exercises[focusIndex] : snapshot.exercises[0];
  const otherExercises = snapshot.exercises.filter((entry) => entry.id !== focusEntry?.id);
  const setCount = snapshot.exercises.reduce((total, entry) => total + entry.sets.length, 0);

  function modeFor(entry: WorkoutSnapshot["exercises"][number]): ExerciseMode {
    const override = modeOverrides[entry.id];

    if (override) return override;

    const lastSet = entry.sets[entry.sets.length - 1];

    if (lastSet) return deriveMode(lastSet.metrics);

    return findSuggestion(suggestions, entry.exercise.name)?.lastSession?.mode ?? "strength";
  }

  function commitSet(workoutExerciseId: string, setId: string | null, metrics: OfflineMetric[]) {
    if (metrics.length === 0) return;

    void queue(
      setId
        ? operation("updateSet", { setId, metrics })
        : operation("addSet", { tempSetId: createId("set"), workoutExerciseId, metrics }),
    );
  }

  function addExercise(name: string) {
    const tempWorkoutExerciseId = createId("exercise");

    setFocusId(tempWorkoutExerciseId);
    void queue(operation("addExercise", { tempWorkoutExerciseId, name, variant: "" }));
  }

  function removeExercise(workoutExerciseId: string) {
    if (workoutExerciseId === focusEntry?.id) {
      const remaining = snapshot.exercises.filter((entry) => entry.id !== workoutExerciseId);

      setFocusId(remaining[0]?.id ?? null);
    }

    void queue(operation("removeExercise", { workoutExerciseId }));
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--surface-app)",
        color: "var(--text-primary)",
        padding: "calc(var(--page-py) + env(safe-area-inset-top)) var(--page-px) calc(var(--space-8) + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="mx-auto flex w-full flex-col"
        style={{ maxWidth: "var(--content-max)", gap: "var(--stack-gap)" }}
      >
        {syncMode === "local" ? (
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-accent-soft)",
              background: "var(--accent-wash)",
              color: "var(--lime-100)",
              padding: "var(--space-3) var(--space-4)",
              font: "var(--type-body-strong)",
            }}
          >
            Preview mode: changes are temporary and are never permanently persisted.
          </div>
        ) : null}

        <header>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              minHeight: 44,
            }}
          >
            <Link
              href="/"
              aria-label="Back to workouts"
              title="Back to workouts"
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: "var(--control-lg)",
                height: "var(--control-lg)",
                flexShrink: 0,
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--border-strong)",
                color: "var(--zinc-200)",
                transition: "var(--transition-default)",
              }}
            >
              <Icon name="arrow_back" size={22} />
            </Link>

            {!snapshot.endedAt ? (
              <button
                type="button"
                aria-label="Finish workout"
                disabled={!canFinishWorkout}
                onClick={() => void queue(operation("finishWorkout", {}))}
                style={{
                  height: 44,
                  padding: "0 var(--space-5)",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid transparent",
                  background: canFinishWorkout ? "var(--accent)" : "var(--zinc-700)",
                  color: canFinishWorkout ? "var(--text-on-accent)" : "var(--zinc-400)",
                  font: "var(--weight-black) var(--text-sm)/1 var(--font-sans)",
                  cursor: canFinishWorkout ? "pointer" : "not-allowed",
                  transition: "var(--transition-default)",
                }}
              >
                Finish
              </button>
            ) : null}
          </div>

          <div
            style={{
              marginTop: "var(--space-3)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-3)",
            }}
          >
            <h1 style={{ margin: 0, font: "var(--type-display)", letterSpacing: "var(--tracking-tight)" }}>
              {snapshot.endedAt ? "Workout complete" : "Active workout"}
            </h1>
            <span style={{ font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)", color: "var(--text-faint)" }}>
              {snapshot.exercises.length} ex · {setCount} sets
            </span>
          </div>

          {!snapshot.endedAt && !canFinishWorkout ? (
            <p style={{ margin: "var(--space-3) 0 0", font: "var(--type-body-strong)", color: "var(--text-faint)" }}>
              {finishError === "missingEntries"
                ? "Workout not finished — every exercise needs at least one set."
                : "Finish unlocks when every exercise has a set."}
            </p>
          ) : null}
        </header>

        <StatusBanner state={syncState} pendingCount={pendingCount} />
        {syncState === "error" ? <SyncErrorToast pendingCount={pendingCount} /> : null}

        {focusEntry ? (
          <FocusExerciseCard
            key={focusEntry.id}
            entry={focusEntry}
            total={snapshot.exercises.length}
            mode={modeFor(focusEntry)}
            suggestions={suggestions}
            onModeChange={(mode) => setModeOverrides((current) => ({ ...current, [focusEntry.id]: mode }))}
            onCommitSet={(setId, metrics) => commitSet(focusEntry.id, setId, metrics)}
            onDeleteSet={(setId) => void queue(operation("deleteSet", { setId }))}
            onRename={(name) => void queue(operation("updateExerciseName", { workoutExerciseId: focusEntry.id, name }))}
            onChangeVariant={(variant) => void queue(operation("updateExerciseVariant", { workoutExerciseId: focusEntry.id, variant }))}
            onRemove={() => removeExercise(focusEntry.id)}
          />
        ) : (
          <section
            className="text-center"
            style={{
              borderRadius: "var(--radius-xl)",
              border: "1px dashed var(--border-strong)",
              padding: "var(--space-8)",
            }}
          >
            <p style={{ margin: 0, font: "var(--weight-black) var(--text-base)/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
              No exercises yet.
            </p>
            <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)", color: "var(--text-faint)" }}>
              Add your first movement and log a set before finishing.
            </p>
          </section>
        )}

        {otherExercises.length > 0 ? (
          <section style={{ display: "grid", gap: "var(--space-2)" }}>
            <span
              style={{
                font: "var(--type-eyebrow)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-eyebrow-sm)",
                color: "var(--text-faint)",
              }}
            >
              Also in this workout
            </span>
            {otherExercises.map((entry) => (
              <CollapsedExerciseRow key={entry.id} entry={entry} onClick={() => setFocusId(entry.id)} />
            ))}
          </section>
        ) : null}

        {!snapshot.endedAt ? (
          <AddExercisePanel
            suggestions={suggestions}
            onAdd={addExercise}
            suggestionsUnavailable={syncMode === "local"}
          />
        ) : null}
      </div>
    </main>
  );
}
