"use client";

import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
    <Alert severity={state === "offline" ? "warning" : "info"}>{text}</Alert>
  );
}

function MetricFields({ metrics = [], autoFocus = false }: { metrics?: OfflineMetric[]; autoFocus?: boolean }) {
  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");
  const time = metric(metrics, "TIME");
  const distance = metric(metrics, "DISTANCE");
  const laps = metric(metrics, "LAPS");

  return (
    <Grid container spacing={1}>
      <Grid size={6}>
        <TextField name="reps" label="Reps" defaultValue={reps?.value ?? ""} autoFocus={autoFocus} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="weight" label="Weight" defaultValue={weight?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="weightUnit" defaultValue={weight?.unit ?? "LB"} select size="small" sx={{ width: 86 }}>
            <MenuItem value="LB">lb</MenuItem>
            <MenuItem value="KG">kg</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="time" label="Time" defaultValue={time?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="timeUnit" defaultValue={time?.unit ?? "MINUTES"} select size="small" sx={{ width: 92 }}>
            <MenuItem value="SECONDS">sec</MenuItem>
            <MenuItem value="MINUTES">min</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="distance" label="Distance" defaultValue={distance?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="distanceUnit" defaultValue={distance?.unit ?? "MILES"} select size="small" sx={{ width: 88 }}>
            <MenuItem value="MILES">mi</MenuItem>
            <MenuItem value="KM">km</MenuItem>
            <MenuItem value="METERS">m</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <TextField name="laps" label="Laps" defaultValue={laps?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
      </Grid>
      <Grid size={6}>
        <Button type="submit" variant="contained" fullWidth startIcon={<SaveIcon />} sx={{ minHeight: 40 }}>
          Save
        </Button>
      </Grid>
    </Grid>
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
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", py: 2.5 }}>
      <Container maxWidth="sm" disableGutters sx={{ px: 2 }}>
        <Stack spacing={2.5}>
          <Card component="header">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Button href="/" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>
                Back to workouts
              </Button>
              <Stack direction="row" spacing={2} sx={{ mt: 2.5, alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{formatDate(snapshot.startedAt)}</Typography>
                  <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
                    {snapshot.endedAt ? "Workout complete" : "Active workout"}
                  </Typography>
                </Box>
                {!snapshot.endedAt ? (
                  <Button variant="contained" disabled={!canFinishWorkout} onClick={() => void queue(operation("finishWorkout", {}))}>
                    Finish
                  </Button>
                ) : null}
              </Stack>

              {!snapshot.endedAt && !canFinishWorkout ? (
                <Alert severity="warning" sx={{ mt: 2.5 }}>
                  <Typography sx={{ fontWeight: 900 }}>{finishError === "missingEntries" ? "Workout not finished." : "Finish locked for now."}</Typography>
                  Add at least one exercise and at least one entry for every exercise before finishing.
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <StatusBanner state={syncState} pendingCount={pendingCount} />

          {!snapshot.endedAt ? (
            <Card component="section">
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Typography variant="h6" component="h2">Add exercise</Typography>
                <Stack
                  component="form"
                  spacing={1.5}
                  sx={{ mt: 2 }}
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
                  <Stack direction="row" spacing={1}>
                    <TextField name="name" placeholder="Bench Press" autoComplete="off" required fullWidth />
                    <Button type="submit" variant="contained" startIcon={<AddIcon />}>Add</Button>
                  </Stack>
                  {suggestions.length > 0 ? (
                    <Typography variant="caption" color="text.secondary">Suggestions remain available from the last online load.</Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {snapshot.exercises.length === 0 ? (
            <Box component="section" sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, p: 4, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 900 }}>No exercises yet.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Add your first movement and log an entry before finishing.</Typography>
            </Box>
          ) : snapshot.exercises.map((entry) => {
            const needsEntry = !snapshot.endedAt && entry.sets.length === 0;

            return (
              <Card component="section" key={entry.id} id={`exercise-${entry.id}`} sx={{ borderColor: needsEntry ? "warning.main" : "divider" }}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.25em" }}>Exercise {entry.order + 1}</Typography>
                      {editingExerciseId === entry.id ? (
                        <Stack
                          component="form"
                          direction="row"
                          spacing={1}
                          sx={{ mt: 1 }}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            const name = String(formData.get("name") ?? "").trim();

                            if (!name) return;

                            setEditingExerciseId(null);
                            void queue(operation("updateExerciseName", { workoutExerciseId: entry.id, name }));
                          }}
                        >
                          <TextField name="name" defaultValue={entry.exercise.name} autoComplete="off" required fullWidth size="small" />
                          <Button type="submit" variant="contained" startIcon={<SaveIcon />}>Save</Button>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
                          <Typography variant="h5" component="h2">{entry.exercise.name}</Typography>
                          {!snapshot.endedAt ? (
                            <IconButton aria-label={`Edit ${entry.exercise.name}`} size="small" sx={{ border: 1, borderColor: "divider" }} onClick={() => setEditingExerciseId(entry.id)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                        </Stack>
                      )}
                    </Box>

                    {!snapshot.endedAt ? (
                      <IconButton color="error" aria-label={`Delete ${entry.exercise.name}`} sx={{ border: 1, borderColor: "rgba(248, 113, 113, 0.4)" }} onClick={() => void queue(operation("removeExercise", { workoutExerciseId: entry.id }))}>
                        <DeleteIcon />
                      </IconButton>
                    ) : null}
                  </Stack>

                  {needsEntry ? <Alert severity="warning" sx={{ mt: 2 }}>Add at least one entry for this exercise before finishing.</Alert> : null}

                  {entry.sets.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 2.5 }}>
                      {entry.sets.map((set) => {
                        const summary = set.metrics.map(formatMetric).join(" · ");
                        const isEditing = editingSetId === set.id;

                        return isEditing ? (
                          <Box
                            component="form"
                            key={set.id}
                            sx={{ border: 1, borderColor: "primary.main", bgcolor: "background.default", borderRadius: 3, p: 1.5 }}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const metrics = metricsFromForm(new FormData(event.currentTarget));

                              if (metrics.length === 0) return;

                              setEditingSetId(null);
                              void queue(operation("updateSet", { setId: set.id, metrics }));
                            }}
                          >
                            <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.2em" }}>Edit Set {set.order + 1}</Typography>
                              <Button type="button" variant="outlined" size="small" onClick={() => setEditingSetId(null)}>Cancel</Button>
                            </Stack>
                            <MetricFields metrics={set.metrics} />
                          </Box>
                        ) : (
                          <Box key={set.id} sx={{ bgcolor: "background.default", borderRadius: 3, p: 1.5 }}>
                            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                              <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.2em" }}>Set {set.order + 1}</Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{summary}</Typography>
                              </Box>
                              {!snapshot.endedAt ? (
                                <Stack direction="row" spacing={1}>
                                  <Button type="button" variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setEditingSetId(set.id)}>Edit</Button>
                                  <Button type="button" variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={() => void queue(operation("deleteSet", { setId: set.id }))}>Remove</Button>
                                </Stack>
                              ) : null}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : null}

                  {!snapshot.endedAt ? (
                    <Box
                      component="form"
                      sx={{ mt: 2.5, border: 1, borderColor: "divider", bgcolor: "background.default", borderRadius: 3, p: 1.5 }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const metrics = metricsFromForm(new FormData(form));

                        if (metrics.length === 0) return;

                        form.reset();
                        void queue(operation("addSet", { tempSetId: createId("set"), workoutExerciseId: entry.id, metrics }));
                      }}
                    >
                      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 900 }}>Quick add set</Typography>
                      <MetricFields autoFocus={entry.id === focusedExerciseId} />
                    </Box>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
