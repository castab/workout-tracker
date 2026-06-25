"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import { PencilIcon, TrashIcon } from "./workout-icons";
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
  syncMode?: "server" | "local";
};

type SyncState = "online" | "offline" | "syncing" | "pending";
type StartingWeight = ExerciseSuggestion["startingWeights"][number];

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

function formatLastUsed(lastUsedAt: string) {
  const daysAgo = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86_400_000);

  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 14) return `${daysAgo}d ago`;
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)}w ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(lastUsedAt));
}

function formatMetric(metric: OfflineMetric) {
  if (metric.type === "REPS") return `${metric.value} reps`;
  if (metric.type === "WEIGHT") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "TIME") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "DISTANCE") return `${metric.value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "LAPS") return `${metric.value} laps`;

  return `${metric.value} ${metric.unit.toLowerCase()}`;
}

function formatWeight(value: string, unit: string) {
  return `${value} ${unit.toLowerCase()}`;
}

function findStartingWeight(suggestions: ExerciseSuggestion[], name: string, variant: string) {
  const suggestion = suggestions.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());

  if (!suggestion) return null;

  const normalizedVariant = variant.trim().toLowerCase();

  if (normalizedVariant) {
    return suggestion.startingWeights.find((item) => item.variant.toLowerCase() === normalizedVariant)
      ?? suggestion.startingWeights.find((item) => item.variant === "")
      ?? suggestion.startingWeights[0]
      ?? null;
  }

  return suggestion.startingWeights.find((item) => item.variant === "") ?? suggestion.startingWeights[0] ?? null;
}

function applyStartingWeight(form: HTMLFormElement | null, startingWeight: StartingWeight) {
  const weightInput = form?.elements.namedItem("weight");
  const weightUnitSelect = form?.elements.namedItem("weightUnit");

  if (weightInput instanceof HTMLInputElement) {
    weightInput.value = startingWeight.value;
    weightInput.focus();
  }

  if (weightUnitSelect instanceof HTMLSelectElement) {
    weightUnitSelect.value = startingWeight.unit;
  }
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

function hasRepsMetric(metrics: OfflineMetric[]) {
  return metrics.some((item) => item.type === "REPS");
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

function AddOfflineExerciseForm({
  onAdd,
  suggestions,
}: {
  onAdd: (name: string, variant: string) => void;
  suggestions: ExerciseSuggestion[];
}) {
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const query = name.trim().toLowerCase();
  const startingWeight = findStartingWeight(suggestions, name, variant);
  const matches = query.length >= 3
    ? suggestions
        .filter((suggestion) => {
          const suggestionName = suggestion.name.toLowerCase();

          return suggestionName.includes(query) && suggestionName !== query;
        })
        .sort((a, b) => {
          const aStartsWith = a.name.toLowerCase().startsWith(query);
          const bStartsWith = b.name.toLowerCase().startsWith(query);

          if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;

          return suggestions.indexOf(a) - suggestions.indexOf(b);
        })
        .slice(0, 5)
    : [];

  function addExercise(nextName: string, nextVariant = variant) {
    const trimmedName = nextName.trim();
    const trimmedVariant = nextVariant.trim();

    if (!trimmedName) return;

    onAdd(trimmedName, trimmedVariant);
    setName("");
    setVariant("");
    inputRef.current?.focus();
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        addExercise(name);
      }}
    >
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="h-14 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
            name="name"
            placeholder="Bench Press"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <button
            className="h-14 rounded-2xl bg-lime-300 px-5 font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
            aria-label="Add exercise"
          >
            Add
          </button>
        </div>
        <input
          className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm font-semibold text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/70 focus:ring-2 focus:ring-lime-300/10"
          name="variant"
          placeholder="Method: Dumbbells, Machine, Treadmill..."
          autoComplete="off"
          value={variant}
          onChange={(event) => setVariant(event.target.value)}
        />
      </div>

      {startingWeight ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2">
          <p className="text-sm font-semibold text-lime-100">
            Last start: {formatWeight(startingWeight.value, startingWeight.unit)}
          </p>
          <p className="shrink-0 text-xs font-semibold text-lime-100/70">
            {formatLastUsed(startingWeight.lastUsedAt)}
          </p>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Suggestions
          </p>
          <div className="space-y-1">
            {matches.map((suggestion) => {
              const startingWeight = findStartingWeight(suggestions, suggestion.name, variant);

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
                  onClick={() => addExercise(suggestion.name)}
                >
                  <span className="font-bold text-zinc-100">{suggestion.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-zinc-500">
                    {startingWeight
                      ? `Last start ${formatWeight(startingWeight.value, startingWeight.unit)} - ${formatLastUsed(startingWeight.lastUsedAt)}`
                      : `Used ${suggestion.usageCount}x - ${formatLastUsed(suggestion.lastUsedAt)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <p className="text-xs text-zinc-500">Suggestions remain available from the last online load.</p>
      ) : null}
    </form>
  );
}

function MetricFields({
  metrics = [],
  autoFocus = false,
  startingWeight = null,
  onDismissStartingWeight,
}: {
  metrics?: OfflineMetric[];
  autoFocus?: boolean;
  startingWeight?: StartingWeight | null;
  onDismissStartingWeight?: () => void;
}) {
  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");
  const time = metric(metrics, "TIME");
  const distance = metric(metrics, "DISTANCE");
  const laps = metric(metrics, "LAPS");

  return (
    <div className="grid grid-cols-2 gap-2">
      {startingWeight ? (
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2">
          <p className="text-sm font-semibold text-lime-100">
            Last start: {formatWeight(startingWeight.value, startingWeight.unit)}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-lime-300 px-3 py-1.5 text-xs font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
              onClick={(event) => {
                applyStartingWeight(event.currentTarget.form, startingWeight);
                onDismissStartingWeight?.();
              }}
            >
              Use
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-full border border-lime-300/30 text-sm font-black text-lime-100 transition hover:border-lime-200 hover:bg-lime-300/10 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
              aria-label="Dismiss starting weight suggestion"
              title="Dismiss"
              onClick={onDismissStartingWeight}
            >
              x
            </button>
          </div>
        </div>
      ) : null}
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
      <button
        className="h-12 rounded-xl bg-lime-300 px-4 font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
        aria-label="Save set"
      >
        Save
      </button>
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
  const [syncState, setSyncState] = useState<SyncState>(typeof navigator === "undefined" || navigator.onLine ? "online" : "offline");
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingVariantExerciseId, setEditingVariantExerciseId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [dismissedStartingWeightIds, setDismissedStartingWeightIds] = useState<Set<string>>(() => new Set());
  const canFinishWorkout = snapshot.exercises.length > 0 && snapshot.exercises.every((entry) => entry.sets.length > 0);

  function dismissStartingWeight(workoutExerciseId: string) {
    setDismissedStartingWeightIds((current) => {
      const next = new Set(current);

      next.add(workoutExerciseId);

      return next;
    });
  }

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
      setSyncState("pending");
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
        {syncMode === "local" ? (
          <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-4 text-sm font-semibold text-lime-100">
            Preview mode: changes are temporary and are never permanently persisted.
          </div>
        ) : null}

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
                className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:hover:bg-zinc-700"
                aria-label="Finish workout"
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
            <AddOfflineExerciseForm
              suggestions={suggestions}
              onAdd={(name, variant) => {
                void queue(operation("addExercise", { tempWorkoutExerciseId: createId("exercise"), name, variant }));
              }}
            />
            {syncMode === "local" ? (
              <p className="mt-3 text-xs text-zinc-500">Exercise suggestions are disabled in browser-only preview mode.</p>
            ) : null}
          </section>
        ) : null}

        {snapshot.exercises.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="font-black text-zinc-200">No exercises yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Add your first movement and log an entry before finishing.</p>
          </section>
        ) : snapshot.exercises.map((entry) => {
          const needsEntry = !snapshot.endedAt && entry.sets.length === 0;
          const hasLoggedReps = entry.sets.some((set) => hasRepsMetric(set.metrics));
          const startingWeight = hasLoggedReps || dismissedStartingWeightIds.has(entry.id)
            ? null
            : findStartingWeight(suggestions, entry.exercise.name, entry.variant);

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
                      <button
                        className="h-12 rounded-2xl bg-lime-300 px-4 font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
                        aria-label={`Save ${entry.exercise.name} name`}
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <h2 className="text-2xl font-black">{entry.exercise.name}</h2>
                      {!snapshot.endedAt ? (
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-lime-300 hover:text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
                          aria-label={`Edit ${entry.exercise.name} name`}
                          title={`Edit ${entry.exercise.name} name`}
                          onClick={() => setEditingExerciseId(entry.id)}
                        >
                          <PencilIcon />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {editingVariantExerciseId === entry.id ? (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        const variant = String(formData.get("variant") ?? "").trim();

                        setEditingVariantExerciseId(null);
                        void queue(operation("updateExerciseVariant", { workoutExerciseId: entry.id, variant }));
                      }}
                    >
                      <input className="h-11 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20" name="variant" defaultValue={entry.variant} autoComplete="off" placeholder="Dumbbells, Machine, Treadmill..." />
                      <button
                        className="h-11 rounded-2xl bg-lime-300 px-4 font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
                        aria-label={`Save ${entry.exercise.name} method`}
                      >
                        Save
                      </button>
                    </form>
                  ) : entry.variant || !snapshot.endedAt ? (
                    <div className="mt-2 flex items-center gap-2">
                      <p className={entry.variant ? "text-sm font-bold text-zinc-300" : "text-sm font-semibold text-zinc-500"}>
                        {entry.variant || "Add method"}
                      </p>
                      {!snapshot.endedAt ? (
                        <button
                          type="button"
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-lime-300 hover:text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
                          aria-label={`Edit ${entry.exercise.name} method`}
                          title={`Edit ${entry.exercise.name} method`}
                          onClick={() => setEditingVariantExerciseId(entry.id)}
                        >
                          <PencilIcon />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!snapshot.endedAt ? (
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-full border border-red-400/40 text-red-200 transition hover:border-red-300"
                    aria-label={`Delete ${entry.exercise.name}`}
                    title={`Delete ${entry.exercise.name}`}
                    onClick={() => void queue(operation("removeExercise", { workoutExerciseId: entry.id }))}
                  >
                    <TrashIcon />
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
                              <PencilIcon />
                            </button>
                            <button className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700" aria-label={`Remove Set ${set.order + 1}`} title={`Remove Set ${set.order + 1}`} onClick={() => void queue(operation("deleteSet", { setId: set.id }))}>
                              <TrashIcon />
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
                  <MetricFields
                    autoFocus={entry.id === focusedExerciseId}
                    startingWeight={startingWeight}
                    onDismissStartingWeight={() => dismissStartingWeight(entry.id)}
                  />
                </form>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
