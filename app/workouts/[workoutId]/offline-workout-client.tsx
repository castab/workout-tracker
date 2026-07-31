"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/app/material-icon";
import { AddExercisePanel } from "@/app/workouts/[workoutId]/add-exercise-panel";
import { CollapsedExerciseRow } from "@/app/workouts/[workoutId]/collapsed-exercise-row";
import { FocusExerciseCard } from "@/app/workouts/[workoutId]/focus-exercise-card";
import {
  addPendingOperation,
  acknowledgePendingOperations,
  getCachedWorkoutSnapshot,
  getPendingOperations,
  saveWorkoutSnapshot,
} from "./offline-workout-store";
import {
  applyWorkoutOperation,
  chooseWorkoutSnapshot,
  overlayWorkoutOperations,
} from "@/lib/workout-sync-client";
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

type SyncRequestOptions = {
  keepalive?: boolean;
  uploadOnly?: boolean;
};

const foregroundSyncIntervalMs = 30_000;
const failedSyncRetryIntervalMs = 20_000;
const syncTimeoutMs = 10_000;

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
            {pendingCount > 0 ? "Changes not synced" : "Connection unavailable"}
          </strong>
          <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)" }}>
            {pendingCount > 0
              ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} couldn't be saved. We'll keep retrying automatically.`
              : "We couldn't reach the server. We'll keep checking automatically."}
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
  const snapshotRef = useRef(initialSnapshot);
  const mountedRef = useRef(false);
  const persistenceRef = useRef<Promise<void>>(Promise.resolve());
  const localGenerationRef = useRef(0);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const syncRequestedRef = useRef(false);
  const fullSyncRequestedRef = useRef(false);
  const keepaliveRequestedRef = useRef(false);
  const syncPendingRef = useRef<(options?: SyncRequestOptions) => Promise<void>>(
    () => Promise.resolve(),
  );

  const canFinishWorkout = snapshot.exercises.length > 0 && snapshot.exercises.every((entry) => entry.sets.length > 0);

  const replaceSnapshot = useCallback((nextSnapshot: WorkoutSnapshot) => {
    snapshotRef.current = nextSnapshot;

    if (mountedRef.current) {
      setSnapshot(nextSnapshot);
    }
  }, []);

  const enqueuePersistence = useCallback((write: () => Promise<void>) => {
    const nextWrite = persistenceRef.current
      .catch(() => undefined)
      .then(write);

    persistenceRef.current = nextWrite;
    return nextWrite;
  }, []);

  const syncPending = useCallback((options: SyncRequestOptions = {}) => {
    if (syncMode === "local") {
      setPendingCount(0);
      setSyncState("online");
      return Promise.resolve();
    }

    syncRequestedRef.current = true;
    keepaliveRequestedRef.current ||= options.keepalive === true;

    if (!options.uploadOnly) {
      fullSyncRequestedRef.current = true;
    }

    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }

    const syncPromise = (async () => {
      while (syncRequestedRef.current) {
        syncRequestedRef.current = false;

        const uploadOnly = !fullSyncRequestedRef.current;
        const keepalive = keepaliveRequestedRef.current;

        fullSyncRequestedRef.current = false;
        keepaliveRequestedRef.current = false;

        await persistenceRef.current.catch(() => undefined);

        if (!navigator.onLine) {
          if (mountedRef.current) setSyncState("offline");
          break;
        }

        const operations = await getPendingOperations(initialSnapshot.id);

        if (mountedRef.current) {
          setPendingCount(operations.length);
        }

        if (uploadOnly && operations.length === 0) {
          continue;
        }

        if (mountedRef.current) {
          setSyncState("syncing");
        }

        const abortController = new AbortController();
        const timeout = window.setTimeout(() => abortController.abort(), syncTimeoutMs);

        try {
          const response = await fetch(`/api/workouts/${initialSnapshot.id}/sync`, {
            method: operations.length > 0 ? "POST" : "GET",
            headers: operations.length > 0 ? { "Content-Type": "application/json" } : undefined,
            body: operations.length > 0 ? JSON.stringify({ operations }) : undefined,
            cache: "no-store",
            keepalive,
            signal: abortController.signal,
          });

          if (!response.ok) throw new Error("Sync failed");

          const data = (await response.json()) as { snapshot: WorkoutSnapshot };

          if (operations.length > 0) {
            await acknowledgePendingOperations(operations.map((item) => item.id));
          }

          let generation: number;
          let remainingOperations: OfflineWorkoutOperation[];

          do {
            generation = localGenerationRef.current;
            await persistenceRef.current.catch(() => undefined);
            remainingOperations = await getPendingOperations(initialSnapshot.id);
          } while (generation !== localGenerationRef.current);

          const nextSnapshot = overlayWorkoutOperations(data.snapshot, remainingOperations);

          replaceSnapshot(nextSnapshot);
          await saveWorkoutSnapshot(nextSnapshot);

          if (mountedRef.current) {
            setPendingCount(remainingOperations.length);
            setSyncState("online");
          }

          if (remainingOperations.length > 0) {
            syncRequestedRef.current = true;
          }
        } catch {
          if (mountedRef.current) {
            setSyncState(navigator.onLine ? "error" : "offline");
          }
          break;
        } finally {
          window.clearTimeout(timeout);
        }
      }
    })().catch(() => {
      if (mountedRef.current) {
        setSyncState(navigator.onLine ? "error" : "offline");
      }
    });

    syncPromiseRef.current = syncPromise;

    void syncPromise.then(() => {
      syncPromiseRef.current = null;

      if (syncRequestedRef.current && mountedRef.current) {
        void syncPendingRef.current();
      }
    });

    return syncPromise;
  }, [initialSnapshot.id, replaceSnapshot, syncMode]);

  useEffect(() => {
    syncPendingRef.current = syncPending;
  }, [syncPending]);

  async function queue(item: OfflineWorkoutOperation) {
    const nextSnapshot = applyWorkoutOperation(snapshotRef.current, item);

    localGenerationRef.current += 1;
    replaceSnapshot(nextSnapshot);

    if (syncMode === "local") {
      await enqueuePersistence(() => saveWorkoutSnapshot(nextSnapshot));
      setPendingCount(0);
      setSyncState("online");
      return;
    }

    try {
      await enqueuePersistence(async () => {
        await addPendingOperation(initialSnapshot.id, item);
        await saveWorkoutSnapshot(nextSnapshot);
      });

      const operations = await getPendingOperations(initialSnapshot.id);
      setPendingCount(operations.length);
      await syncPending();
    } catch {
      setSyncState("error");
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      let cached: WorkoutSnapshot | undefined;
      let operations: OfflineWorkoutOperation[];
      let generation: number;

      do {
        generation = localGenerationRef.current;
        await persistenceRef.current.catch(() => undefined);
        [cached, operations] = await Promise.all([
          getCachedWorkoutSnapshot(initialSnapshot.id),
          getPendingOperations(initialSnapshot.id),
        ]);
      } while (generation !== localGenerationRef.current);

      if (!mountedRef.current) return;

      const preferredSnapshot = chooseWorkoutSnapshot(initialSnapshot, cached, operations);
      const hydratedSnapshot = overlayWorkoutOperations(preferredSnapshot, operations);

      replaceSnapshot(hydratedSnapshot);
      await saveWorkoutSnapshot(hydratedSnapshot);
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

    function handleFocus() {
      if (document.visibilityState === "visible") {
        void syncPending();
      }
    }

    function handlePageHide() {
      void syncPending({ keepalive: true, uploadOnly: true });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncPending();
      } else {
        void syncPending({ keepalive: true, uploadOnly: true });
      }
    }

    void load();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialSnapshot, replaceSnapshot, syncPending]);

  useEffect(() => {
    if (syncMode === "local") return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncPending();
      }
    }, foregroundSyncIntervalMs);

    return () => window.clearInterval(interval);
  }, [syncMode, syncPending]);

  useEffect(() => {
    if (syncState !== "error") return;

    const retry = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncPending();
      }
    }, failedSyncRetryIntervalMs);

    return () => window.clearInterval(retry);
  }, [syncState, syncPending]);

  // The focused exercise can vanish when another client deletes it. Fall back
  // to the first remaining exercise.
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
