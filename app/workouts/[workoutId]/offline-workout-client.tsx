"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import {
  addPendingOperation,
  clearPendingOperations,
  getCachedWorkoutSnapshot,
  getPendingOperations,
  saveWorkoutSnapshot,
} from "./offline-workout-store";
import type { OfflineMetric, OfflineWorkoutOperation, WorkoutSnapshot } from "@/lib/workout-sync-types";

type OfflineWorkoutClientProps = {
  initialSnapshot: WorkoutSnapshot;
  suggestions: ExerciseSuggestion[];
  focusedExerciseId?: string;
  finishError?: string;
};

type SyncState = "online" | "offline" | "syncing" | "pending";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMetric(metric: OfflineMetric) {
  if (metric.type === "REPS") return `${metric.value} reps`;
  if (metric.type === "WEIGHT") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "TIME") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "DISTANCE") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "LAPS") return `${metric.value} laps`;

  return `${metric.value} ${metric.unit.toLowerCase()}`;
}

function metricValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value === "" ? null : value;
}

function metricUnit(formData: FormData, key: string, fallback: OfflineMetric["unit"]) {
  const value = String(formData.get(key) ?? "").trim();

  return (value || fallback) as OfflineMetric["unit"];
}

function metricsFromForm(formData: FormData): OfflineMetric[] {
  const metrics: (Omit<OfflineMetric, "value"> & { value: string | null })[] = [
    { type: "REPS" as const, unit: "COUNT" as const, value: metricValue(formData, "reps") },
    { type: "WEIGHT" as const, unit: metricUnit(formData, "weightUnit", "LB"), value: metricValue(formData, "weight") },
    { type: "TIME" as const, unit: metricUnit(formData, "timeUnit", "MINUTES"), value: metricValue(formData, "time") },
    { type: "DISTANCE" as const, unit: metricUnit(formData, "distanceUnit", "MILES"), value: metricValue(formData, "distance") },
    { type: "LAPS" as const, unit: "LAPS" as const, value: metricValue(formData, "laps") },
  ];

  return metrics.filter((item): item is OfflineMetric => item.value !== null);
}

function metric(metrics: OfflineMetric[], type: OfflineMetric["type"]) {
  return metrics.find((item) => item.type === type);
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
  if (state === "online" && pendingCount === 0) return null;

  const text = state === "offline"
    ? `${pendingCount} offline change${pendingCount === 1 ? "" : "s"} queued.`
    : state === "syncing"
      ? "Syncing offline changes..."
      : `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`;

  return (
    <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-4 text-sm font-semibold text-lime-100">
      {text}
    </div>
  );
}

function MetricFields({ metrics = [], autoFocus = false }: { metrics?: OfflineMetric[]; autoFocus?: boolean }) {
  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");
  const time = metric(metrics, "TIME");
  const distance = metric(metrics, "DISTANCE");
  const laps = metric(metrics, "LAPS");

  return (
    <div className="grid grid-cols-2 gap-2">
      <input className="metric-input" name="reps" inputMode="decimal" placeholder="Reps" defaultValue={reps?.value ?? ""} autoFocus={autoFocus} />
      <div className="flex gap-1">
        <input className="metric-input" name="weight" inputMode="decimal" placeholder="Weight" defaultValue={weight?.value ?? ""} />
        <select className="metric-select" name="weightUnit" defaultValue={weight?.unit ?? "LB"}>
          <option value="LB">lb</option>
          <option value="KG">kg</option>
        </select>
      </div>
      <div className="flex gap-1">
        <input className="metric-input" name="time" inputMode="decimal" placeholder="Time" defaultValue={time?.value ?? ""} />
        <select className="metric-select" name="timeUnit" defaultValue={time?.unit ?? "MINUTES"}>
          <option value="SECONDS">sec</option>
          <option value="MINUTES">min</option>
        </select>
      </div>
      <div className="flex gap-1">
        <input className="metric-input" name="distance" inputMode="decimal" placeholder="Distance" defaultValue={distance?.value ?? ""} />
        <select className="metric-select" name="distanceUnit" defaultValue={distance?.unit ?? "MILES"}>
          <option value="MILES">mi</option>
          <option value="KM">km</option>
          <option value="METERS">m</option>
        </select>
      </div>
      <input className="metric-input" name="laps" inputMode="decimal" placeholder="Laps" defaultValue={laps?.value ?? ""} />
      <button className="h-12 rounded-xl bg-lime-300 px-4 font-black text-zinc-950">Save</button>
    </div>
  );
}

export function OfflineWorkoutClient({ initialSnapshot, suggestions, focusedExerciseId, finishError }: OfflineWorkoutClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(typeof navigator === "undefined" || navigator.onLine ? "online" : "offline");
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const canFinishWorkout = snapshot.exercises.length > 0 && snapshot.exercises.every((entry) => entry.sets.length > 0);

  const syncPending = useCallback(async () => {
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
      setSyncState("pending");
    }
  }, [snapshot.id]);

  async function queue(item: OfflineWorkoutOperation) {
    const nextSnapshot = applyOperation(snapshot, item);

    setSnapshot(nextSnapshot);
    await saveWorkoutSnapshot(nextSnapshot);
    await addPendingOperation(snapshot.id, item);
    const operations = await getPendingOperations(snapshot.id);
    setPendingCount(operations.length);
    setSyncState(navigator.onLine ? "pending" : "offline");

    if (navigator.onLine) {
      await syncPending();
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

    void load();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initialSnapshot, syncPending]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
          <Link href="/" className="text-sm font-bold text-lime-300">← Back to workouts</Link>

          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">{formatDate(snapshot.startedAt)}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {snapshot.endedAt ? "Workout complete" : "Active workout"}
              </h1>
            </div>

            {!snapshot.endedAt ? (
              <button
                className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                disabled={!canFinishWorkout}
                onClick={() => void queue(operation("finishWorkout", {}))}
              >
                Finish
              </button>
            ) : null}
          </div>

          {!snapshot.endedAt && !canFinishWorkout ? (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <p className="text-sm font-black text-amber-100">
                {finishError === "missingEntries" ? "Workout not finished." : "Finish locked for now."}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-100/80">
                Add at least one exercise and at least one entry for every exercise before finishing.
              </p>
            </div>
          ) : null}
        </header>

        <StatusBanner state={syncState} pendingCount={pendingCount} />

        {!snapshot.endedAt ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xl font-black">Add exercise</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const name = String(formData.get("name") ?? "").trim();

                if (!name) return;

                form.reset();
                void queue(operation("addExercise", { tempWorkoutExerciseId: createId("exercise"), name }));
              }}
            >
              <div className="flex gap-2">
                <input className="h-14 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20" name="name" placeholder="Bench Press" autoComplete="off" required />
                <button className="h-14 rounded-2xl bg-lime-300 px-5 font-black text-zinc-950">Add</button>
              </div>
              {suggestions.length > 0 ? (
                <p className="text-xs text-zinc-500">Suggestions remain available from the last online load.</p>
              ) : null}
            </form>
          </section>
        ) : null}

        {snapshot.exercises.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="font-black text-zinc-200">No exercises yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Add your first movement and log an entry before finishing.</p>
          </section>
        ) : snapshot.exercises.map((entry) => {
          const needsEntry = !snapshot.endedAt && entry.sets.length === 0;

          return (
            <section key={entry.id} id={`exercise-${entry.id}`} className={`rounded-3xl border bg-zinc-900 p-5 shadow-xl shadow-black/10 ${needsEntry ? "border-amber-300/50" : "border-zinc-800"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">Exercise {entry.order + 1}</p>
                  {editingExerciseId === entry.id ? (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        const name = String(formData.get("name") ?? "").trim();

                        if (!name) return;

                        setEditingExerciseId(null);
                        void queue(operation("updateExerciseName", { workoutExerciseId: entry.id, name }));
                      }}
                    >
                      <input className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base font-black outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20" name="name" defaultValue={entry.exercise.name} autoComplete="off" required />
                      <button className="h-12 rounded-2xl bg-lime-300 px-4 font-black text-zinc-950">Save</button>
                    </form>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <h2 className="text-2xl font-black">{entry.exercise.name}</h2>
                      {!snapshot.endedAt ? (
                        <button type="button" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400" onClick={() => setEditingExerciseId(entry.id)}>✎</button>
                      ) : null}
                    </div>
                  )}
                </div>

                {!snapshot.endedAt ? (
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-full border border-red-400/40 text-red-200 transition hover:border-red-300"
                    aria-label={`Delete ${entry.exercise.name}`}
                    title={`Delete ${entry.exercise.name}`}
                    onClick={() => void queue(operation("removeExercise", { workoutExerciseId: entry.id }))}
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20">
                      <path d="M3.5 5.5h13" />
                      <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
                      <path d="M5.5 5.5 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6A1.5 1.5 0 0 0 13.8 16l.7-10.5" />
                      <path d="M8.5 8.5v5" />
                      <path d="M11.5 8.5v5" />
                    </svg>
                  </button>
                ) : null}
              </div>

              {needsEntry ? <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">Add at least one entry for this exercise before finishing.</p> : null}

              {entry.sets.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {entry.sets.map((set) => {
                    const summary = set.metrics.map(formatMetric).join(" · ");
                    const isEditing = editingSetId === set.id;

                    return isEditing ? (
                      <form
                        key={set.id}
                        className="rounded-2xl border border-lime-300/30 bg-zinc-950 p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const metrics = metricsFromForm(new FormData(event.currentTarget));

                          if (metrics.length === 0) return;

                          setEditingSetId(null);
                          void queue(operation("updateSet", { setId: set.id, metrics }));
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-200">Edit Set {set.order + 1}</p>
                          <button type="button" className="rounded-full border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300" onClick={() => setEditingSetId(null)}>Cancel</button>
                        </div>
                        <MetricFields metrics={set.metrics} />
                      </form>
                    ) : (
                      <div key={set.id} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Set {set.order + 1}</p>
                          <p className="mt-1 text-sm font-semibold text-zinc-200">{summary}</p>
                        </div>
                        {!snapshot.endedAt ? (
                          <div className="flex shrink-0 gap-2">
                            <button type="button" className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700" aria-label={`Edit Set ${set.order + 1}`} title={`Edit Set ${set.order + 1}`} onClick={() => setEditingSetId(set.id)}>
                              <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 14.5V16h1.5L15.1 6.4l-1.5-1.5L4 14.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                <path d="m12.6 4.9 1-1a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-1 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                            <button className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700" aria-label={`Remove Set ${set.order + 1}`} title={`Remove Set ${set.order + 1}`} onClick={() => void queue(operation("deleteSet", { setId: set.id }))}>
                              <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20">
                                <path d="M3.5 5.5h13" />
                                <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
                                <path d="M5.5 5.5 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6A1.5 1.5 0 0 0 13.8 16l.7-10.5" />
                                <path d="M8.5 8.5v5" />
                                <path d="M11.5 8.5v5" />
                              </svg>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!snapshot.endedAt ? (
                <form
                  className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const metrics = metricsFromForm(new FormData(form));

                    if (metrics.length === 0) return;

                    form.reset();
                    void queue(operation("addSet", { tempSetId: createId("set"), workoutExerciseId: entry.id, metrics }));
                  }}
                >
                  <p className="mb-3 text-sm font-black text-zinc-300">Quick add set</p>
                  <MetricFields autoFocus={entry.id === focusedExerciseId} />
                </form>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
