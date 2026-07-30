"use client";

import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const inputFieldClass =
  "h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20";

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
    <Alert variant="success">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
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
          <Popover open={matches.length > 0}>
            <PopoverAnchor asChild>
              <Input
                ref={inputRef}
                className={`${inputFieldClass} flex-1`}
                name="name"
                placeholder="Bench Press"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </PopoverAnchor>
            <PopoverContent
              className="w-(--radix-popover-trigger-width) p-2"
              align="start"
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandGroup heading="Suggestions">
                    {matches.map((suggestion) => {
                      const suggestionStartingWeight = findStartingWeight(suggestions, suggestion.name, variant);

                      return (
                        <CommandItem
                          key={suggestion.id}
                          value={suggestion.id}
                          onSelect={() => addExercise(suggestion.name)}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="font-bold text-zinc-100">{suggestion.name}</span>
                          <span className="shrink-0 text-xs font-semibold text-zinc-500">
                            {suggestionStartingWeight
                              ? `Last start ${formatWeight(suggestionStartingWeight.value, suggestionStartingWeight.unit)} - ${formatLastUsed(suggestionStartingWeight.lastUsedAt)}`
                              : `Used ${suggestion.usageCount}x - ${formatLastUsed(suggestion.lastUsedAt)}`}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button className="h-14 rounded-2xl px-5 font-black" aria-label="Add exercise">
            Add
          </Button>
        </div>
        <Input
          className="h-10 rounded-xl bg-zinc-950/70 px-3 text-sm font-semibold placeholder:text-zinc-600 focus-visible:border-lime-300/70 focus-visible:ring-lime-300/10"
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
  const selectTriggerClass = "h-12 w-full rounded-xl bg-zinc-900 px-2 text-sm font-bold text-zinc-200 focus-visible:border-lime-300 focus-visible:ring-lime-300/20";
  const metricInputClass = "h-12 rounded-xl bg-zinc-900 px-3 text-base placeholder:text-zinc-600 focus-visible:border-lime-300 focus-visible:ring-lime-300/20";

  return (
    <div className="grid grid-cols-2 gap-2">
      {startingWeight ? (
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2">
          <p className="text-sm font-semibold text-lime-100">
            Last start: {formatWeight(startingWeight.value, startingWeight.unit)}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full text-xs font-black"
              onClick={(event) => {
                applyStartingWeight(event.currentTarget.form, startingWeight);
                onDismissStartingWeight?.();
              }}
            >
              Use
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 rounded-full border-lime-300/30 text-lime-100 hover:border-lime-200 hover:bg-lime-300/10 hover:text-lime-100"
              aria-label="Dismiss starting weight suggestion"
              title="Dismiss"
              onClick={onDismissStartingWeight}
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}
      <Input className={metricInputClass} name="reps" inputMode="decimal" placeholder="Reps" defaultValue={reps?.value ?? ""} autoFocus={autoFocus} />
      <div className="flex gap-1">
        <Input className={`${metricInputClass} min-w-0 flex-1`} name="weight" inputMode="decimal" placeholder="Weight" defaultValue={weight?.value ?? ""} />
        <Select name="weightUnit" defaultValue={weight?.unit ?? "LB"}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="LB">lb</SelectItem>
              <SelectItem value="KG">kg</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1">
        <Input className={`${metricInputClass} min-w-0 flex-1`} name="time" inputMode="decimal" placeholder="Time" defaultValue={time?.value ?? ""} />
        <Select name="timeUnit" defaultValue={time?.unit ?? "MINUTES"}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="SECONDS">sec</SelectItem>
              <SelectItem value="MINUTES">min</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1">
        <Input className={`${metricInputClass} min-w-0 flex-1`} name="distance" inputMode="decimal" placeholder="Distance" defaultValue={distance?.value ?? ""} />
        <Select name="distanceUnit" defaultValue={distance?.unit ?? "MILES"}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="MILES">mi</SelectItem>
              <SelectItem value="KM">km</SelectItem>
              <SelectItem value="METERS">m</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Input className={metricInputClass} name="laps" inputMode="decimal" placeholder="Laps" defaultValue={laps?.value ?? ""} />
      <Button className="h-12 rounded-xl px-4 font-black" aria-label="Save set">
        Save
      </Button>
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

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        {syncMode === "local" ? (
          <Alert variant="success">
            <AlertDescription>Preview mode: changes are temporary and are never permanently persisted.</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20 ring-0">
          <CardContent className="p-0">
            <Link href="/" className="text-sm font-bold text-lime-300">← Back to workouts</Link>

            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-400">{formatDate(snapshot.startedAt)}</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight">
                  {snapshot.endedAt ? "Workout complete" : "Active workout"}
                </h1>
              </div>

              {!snapshot.endedAt ? (
                <Button
                  className="h-auto rounded-full px-4 py-2 text-sm font-black"
                  aria-label="Finish workout"
                  disabled={!canFinishWorkout}
                  onClick={() => void queue(operation("finishWorkout", {}))}
                >
                  Finish
                </Button>
              ) : null}
            </div>

            {!snapshot.endedAt && !canFinishWorkout ? (
              <Alert variant="warning" className="mt-5">
                <AlertDescription className="font-black">
                  {finishError === "missingEntries" ? "Workout not finished." : "Finish locked for now."}
                </AlertDescription>
                <AlertDescription>
                  Add at least one exercise and at least one entry for every exercise before finishing.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <StatusBanner state={syncState} pendingCount={pendingCount} />

        {!snapshot.endedAt ? (
          <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
            <CardHeader className="p-0">
              <h2 className="text-xl font-black">Add exercise</h2>
            </CardHeader>
            <CardContent className="p-0">
              <AddOfflineExerciseForm
                suggestions={suggestions}
                onAdd={(name, variant) => {
                  void queue(operation("addExercise", { tempWorkoutExerciseId: createId("exercise"), name, variant }));
                }}
              />
              {syncMode === "local" ? (
                <p className="mt-3 text-xs text-zinc-500">Exercise suggestions are disabled in browser-only preview mode.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {snapshot.exercises.length === 0 ? (
          <Empty className="rounded-3xl border border-zinc-700 p-8">
            <EmptyTitle className="font-black text-zinc-200">No exercises yet.</EmptyTitle>
            <EmptyDescription className="text-zinc-500">Add your first movement and log an entry before finishing.</EmptyDescription>
          </Empty>
        ) : snapshot.exercises.map((entry) => {
          const needsEntry = !snapshot.endedAt && entry.sets.length === 0;
          const hasLoggedReps = entry.sets.some((set) => hasRepsMetric(set.metrics));
          const startingWeight = hasLoggedReps || dismissedStartingWeightIds.has(entry.id)
            ? null
            : findStartingWeight(suggestions, entry.exercise.name, entry.variant);

          return (
            <Card
              key={entry.id}
              id={`exercise-${entry.id}`}
              className={`rounded-3xl border bg-zinc-900 p-5 shadow-xl shadow-black/10 ring-0 ${needsEntry ? "border-amber-300/50" : "border-zinc-800"}`}
            >
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">Exercise {entry.order + 1}</p>

                    <div className="mt-2 flex items-center gap-2">
                      <h2 className="text-2xl font-black">{entry.exercise.name}</h2>
                      {!snapshot.endedAt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-full border-zinc-700 text-zinc-400 hover:border-lime-300 hover:bg-transparent hover:text-lime-200"
                          aria-label={`Edit ${entry.exercise.name} name`}
                          title={`Edit ${entry.exercise.name} name`}
                          onClick={() => setEditingExerciseId(entry.id)}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                    </div>

                    <Dialog
                      open={editingExerciseId === entry.id}
                      onOpenChange={(open) => setEditingExerciseId(open ? entry.id : null)}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit exercise name</DialogTitle>
                        </DialogHeader>
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            const name = String(formData.get("name") ?? "").trim();

                            if (!name) return;

                            setEditingExerciseId(null);
                            void queue(operation("updateExerciseName", { workoutExerciseId: entry.id, name }));
                          }}
                        >
                          <Input
                            className="h-12 min-w-0 flex-1 rounded-2xl bg-zinc-950 px-4 text-base font-black focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                            name="name"
                            defaultValue={entry.exercise.name}
                            autoComplete="off"
                            required
                          />
                          <Button className="h-12 rounded-2xl px-4 font-black" aria-label={`Save ${entry.exercise.name} name`}>
                            Save
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {entry.variant || !snapshot.endedAt ? (
                      <div className="mt-2 flex items-center gap-2">
                        <p className={entry.variant ? "text-sm font-bold text-zinc-300" : "text-sm font-semibold text-zinc-500"}>
                          {entry.variant || "Add method"}
                        </p>
                        {!snapshot.endedAt ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7 rounded-full border-zinc-700 text-zinc-400 hover:border-lime-300 hover:bg-transparent hover:text-lime-200"
                            aria-label={`Edit ${entry.exercise.name} method`}
                            title={`Edit ${entry.exercise.name} method`}
                            onClick={() => setEditingVariantExerciseId(entry.id)}
                          >
                            <Pencil />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <Dialog
                      open={editingVariantExerciseId === entry.id}
                      onOpenChange={(open) => setEditingVariantExerciseId(open ? entry.id : null)}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit {entry.exercise.name} method</DialogTitle>
                        </DialogHeader>
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            const variant = String(formData.get("variant") ?? "").trim();

                            setEditingVariantExerciseId(null);
                            void queue(operation("updateExerciseVariant", { workoutExerciseId: entry.id, variant }));
                          }}
                        >
                          <Input
                            className="h-11 min-w-0 flex-1 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                            name="variant"
                            defaultValue={entry.variant}
                            autoComplete="off"
                            placeholder="Dumbbells, Machine, Treadmill..."
                          />
                          <Button className="h-11 rounded-2xl px-4 font-black" aria-label={`Save ${entry.exercise.name} method`}>
                            Save
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {!snapshot.endedAt ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full border-red-400/40 text-red-200 hover:border-red-300 hover:bg-transparent hover:text-red-200"
                      aria-label={`Delete ${entry.exercise.name}`}
                      title={`Delete ${entry.exercise.name}`}
                      onClick={() => void queue(operation("removeExercise", { workoutExerciseId: entry.id }))}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>

                {needsEntry ? (
                  <Alert variant="warning" className="mt-4">
                    <AlertDescription>Add at least one entry for this exercise before finishing.</AlertDescription>
                  </Alert>
                ) : null}

                {entry.sets.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    {entry.sets.map((set) => {
                      const summary = set.metrics.map(formatMetric).join(" · ");

                      return (
                        <div key={set.id}>
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Set {set.order + 1}</p>
                              <p className="mt-1 text-sm font-semibold text-zinc-200">{summary}</p>
                            </div>
                            {!snapshot.endedAt ? (
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  className="size-9 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                  aria-label={`Edit Set ${set.order + 1}`}
                                  title={`Edit Set ${set.order + 1}`}
                                  onClick={() => setEditingSetId(set.id)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="size-9 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                  aria-label={`Remove Set ${set.order + 1}`}
                                  title={`Remove Set ${set.order + 1}`}
                                  onClick={() => void queue(operation("deleteSet", { setId: set.id }))}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          <Dialog
                            open={editingSetId === set.id}
                            onOpenChange={(open) => setEditingSetId(open ? set.id : null)}
                          >
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Set {set.order + 1}</DialogTitle>
                              </DialogHeader>
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const metrics = metricsFromForm(new FormData(event.currentTarget));

                                  if (metrics.length === 0) return;

                                  setEditingSetId(null);
                                  void queue(operation("updateSet", { setId: set.id, metrics }));
                                }}
                              >
                                <MetricFields metrics={set.metrics} />
                              </form>
                            </DialogContent>
                          </Dialog>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
