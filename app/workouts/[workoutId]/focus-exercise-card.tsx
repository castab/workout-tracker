"use client";

import { useState } from "react";
import { Icon } from "@/app/material-icon";
import { MetricTile } from "@/app/workouts/[workoutId]/metric-tile";
import {
  type ExerciseMode,
  type SetDraft,
  draftHasValue,
  draftToMetrics,
  emptyDraft,
  formatLastUsed,
  formatSetCompact,
  metricsToDraft,
} from "@/lib/workout-metrics";
import { type ExerciseSuggestion, findStartingWeight, findSuggestion } from "@/lib/workout-suggestions";
import type { OfflineMetric, WorkoutSnapshot } from "@/lib/workout-sync-types";

const REP_STEP = 1;
const WEIGHT_STEP = 5;
const TIME_STEP = 1;
const DISTANCE_STEP = 0.1;
const LAP_STEP = 1;

const timeUnits: SetDraft["timeUnit"][] = ["MINUTES", "SECONDS"];
const distanceUnits: SetDraft["distanceUnit"][] = ["MILES", "KM", "METERS"];

const unitLabels: Record<string, string> = {
  LB: "lb",
  KG: "kg",
  MINUTES: "min",
  SECONDS: "sec",
  MILES: "mi",
  KM: "km",
  METERS: "m",
};

function cycle<T>(options: T[], current: T): T {
  const index = options.indexOf(current);

  return options[(index + 1) % options.length];
}

type FocusExerciseCardProps = {
  entry: WorkoutSnapshot["exercises"][number];
  total: number;
  mode: ExerciseMode;
  suggestions: ExerciseSuggestion[];
  onModeChange: (mode: ExerciseMode) => void;
  onCommitSet: (setId: string | null, metrics: OfflineMetric[]) => void;
  onDeleteSet: (setId: string) => void;
  onRename: (name: string) => void;
  onChangeVariant: (variant: string) => void;
  onRemove: () => void;
};

function LastTimeLine({ suggestion }: { suggestion: ExerciseSuggestion | null }) {
  if (!suggestion?.lastSession || suggestion.lastSession.setSummaries.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "var(--space-3)",
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-2)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          font: "var(--type-eyebrow)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-eyebrow-sm)",
          color: "var(--text-faint)",
        }}
      >
        Last time {formatLastUsed(suggestion.lastSession.performedAt)}
      </span>
      <span style={{ font: "var(--weight-semibold) var(--text-sm)/1.3 var(--font-mono)", color: "var(--text-muted)" }}>
        {suggestion.lastSession.setSummaries.join("  ·  ")}
      </span>
    </div>
  );
}

function SetLine({
  number,
  text,
  isEditing,
  onClick,
}: {
  number: number;
  text: string;
  isEditing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 44,
        textAlign: "left",
        padding: "0 var(--space-3)",
        cursor: "pointer",
        transition: "var(--transition-default)",
        borderRadius: "var(--radius-lg)",
        background: isEditing ? "var(--accent-wash)" : "var(--surface-sunken)",
        border: `1px solid ${isEditing ? "var(--border-accent-soft)" : "transparent"}`,
      }}
    >
      <span
        style={{
          width: 22,
          flexShrink: 0,
          font: "var(--weight-black) var(--text-sm)/1 var(--font-mono)",
          color: isEditing ? "var(--text-accent)" : "var(--text-faint)",
        }}
      >
        {number}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          font: "var(--weight-semibold) var(--text-base)/1.4 var(--font-mono)",
          color: "var(--text-secondary)",
        }}
      >
        {text}
      </span>
      <span
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          font: "var(--weight-bold) var(--text-xs)/1 var(--font-sans)",
          color: isEditing ? "var(--text-accent)" : "var(--text-faint)",
        }}
      >
        {isEditing ? "editing" : <Icon name="edit" size={18} weight={500} />}
      </span>
    </button>
  );
}

export function FocusExerciseCard({
  entry,
  total,
  mode,
  suggestions,
  onModeChange,
  onCommitSet,
  onDeleteSet,
  onRename,
  onChangeVariant,
  onRemove,
}: FocusExerciseCardProps) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingVariant, setIsEditingVariant] = useState(false);

  const suggestion = findSuggestion(suggestions, entry.exercise.name);
  const lastSet = entry.sets[entry.sets.length - 1];
  const isCardio = mode === "cardio";

  /**
   * The pad opens pre-loaded with the last set's numbers — the common case is
   * repeating it, and the second most common is one tap of +/− away.
   */
  function seedDraft(): SetDraft {
    const editingSet = editingSetId ? entry.sets.find((set) => set.id === editingSetId) : undefined;

    if (editingSet) return metricsToDraft(editingSet.metrics);

    if (lastSet) {
      const seeded = metricsToDraft(lastSet.metrics);

      // Carry units across a mode switch, but not the other mode's values.
      return isCardio
        ? { ...emptyDraft, timeUnit: seeded.timeUnit, distanceUnit: seeded.distanceUnit, time: seeded.time, distance: seeded.distance, laps: seeded.laps }
        : { ...emptyDraft, weightUnit: seeded.weightUnit, reps: seeded.reps, weight: seeded.weight };
    }

    // No prior set in this workout. Only the strength path has a useful seed —
    // the starting weight from history. Cardio distances/times vary too much.
    if (isCardio) return emptyDraft;

    const startingWeight = findStartingWeight(suggestions, entry.exercise.name, entry.variant);

    if (!startingWeight) return emptyDraft;

    return { ...emptyDraft, weight: startingWeight.value, weightUnit: startingWeight.unit };
  }

  /*
   * The pad is derived state that must reset on three signals: switching which
   * set is being edited, committing a set (sets.length moves), and flipping
   * mode. Rather than an effect that fires after paint, the draft is re-seeded
   * during render whenever that signature changes — React's documented pattern
   * for adjusting state on prop change, and it avoids a frame of stale numbers.
   */
  const seedKey = `${editingSetId ?? "new"}:${mode}:${entry.sets.length}`;
  const [pad, setPad] = useState(() => ({ key: seedKey, draft: seedDraft() }));

  if (pad.key !== seedKey) {
    setPad({ key: seedKey, draft: seedDraft() });
  }

  const draft = pad.draft;
  const setDraft = (update: (current: SetDraft) => SetDraft) =>
    setPad((current) => ({ ...current, draft: update(current.draft) }));

  const canCommit = draftHasValue(draft, mode);
  const editingSetIndex = entry.sets.findIndex((set) => set.id === editingSetId);

  function commit() {
    if (!canCommit) return;

    onCommitSet(editingSetId, draftToMetrics(draft, mode));
    setEditingSetId(null);
  }

  // Re-seeding is handled by seedKey; this only moves the target.
  function toggleSetEditing(setId: string) {
    setEditingSetId((current) => (current === setId ? null : setId));
  }

  const set = <K extends keyof SetDraft>(key: K) => (value: SetDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-accent-soft)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--card-p)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              font: "var(--type-eyebrow)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--text-accent)",
            }}
          >
            Now · exercise {entry.order + 1} of {total}
          </span>

          {isRenaming ? (
            <form
              style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}
              onSubmit={(event) => {
                event.preventDefault();
                const value = String(new FormData(event.currentTarget).get("name") ?? "").trim();

                if (!value) return;

                onRename(value);
                setIsRenaming(false);
              }}
            >
              <input
                name="name"
                defaultValue={entry.exercise.name}
                autoComplete="off"
                autoFocus
                required
                aria-label="Exercise name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "var(--control-field)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-sunken)",
                  padding: "0 var(--space-4)",
                  font: "var(--weight-black) var(--text-base)/1 var(--font-sans)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  height: "var(--control-field)",
                  padding: "0 var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid transparent",
                  background: "var(--accent)",
                  color: "var(--text-on-accent)",
                  font: "var(--weight-black) var(--text-base)/1 var(--font-sans)",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </form>
          ) : (
            <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <h2
                style={{
                  margin: 0,
                  font: "var(--type-exercise)",
                  letterSpacing: "var(--tracking-tight)",
                  color: "var(--text-primary)",
                }}
              >
                {entry.exercise.name}
              </h2>
              <button
                type="button"
                onClick={() => setIsRenaming(true)}
                aria-label={`Rename ${entry.exercise.name}`}
                title={`Rename ${entry.exercise.name}`}
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "var(--transition-default)",
                }}
              >
                <Icon name="edit" size={18} weight={500} />
              </button>
            </div>
          )}

          {isEditingVariant ? (
            <form
              style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}
              onSubmit={(event) => {
                event.preventDefault();
                const value = String(new FormData(event.currentTarget).get("variant") ?? "").trim();

                onChangeVariant(value);
                setIsEditingVariant(false);
              }}
            >
              <input
                name="variant"
                defaultValue={entry.variant}
                placeholder="Dumbbells, Machine, Treadmill..."
                autoComplete="off"
                autoFocus
                aria-label="Method"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "var(--control-md)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-sunken)",
                  padding: "0 var(--space-3)",
                  font: "var(--weight-semibold) var(--text-sm)/1 var(--font-sans)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  height: "var(--control-md)",
                  padding: "0 var(--space-3)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid transparent",
                  background: "var(--accent)",
                  color: "var(--text-on-accent)",
                  font: "var(--weight-black) var(--text-xs)/1 var(--font-sans)",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </form>
          ) : (
            <div style={{ marginTop: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => setIsEditingVariant(true)}
                aria-label={entry.variant ? `Edit method: ${entry.variant}` : "Add method"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: "var(--radius-pill)",
                  padding: "var(--space-1) var(--space-3)",
                  border: entry.variant ? "1px solid transparent" : "1px dashed var(--border-strong)",
                  background: entry.variant ? "var(--surface-chip)" : "transparent",
                  color: entry.variant ? "var(--text-secondary)" : "var(--text-faint)",
                  font: "var(--weight-bold) var(--text-xs)/1rem var(--font-sans)",
                  cursor: "pointer",
                  transition: "var(--transition-default)",
                }}
              >
                {entry.variant || "Add method"}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entry.exercise.name}`}
          title={`Remove ${entry.exercise.name}`}
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: "var(--radius-pill)",
            border: "1px solid color-mix(in srgb, var(--red-400) 40%, transparent)",
            background: "transparent",
            color: "var(--red-200)",
            cursor: "pointer",
            transition: "var(--transition-default)",
          }}
        >
          <Icon name="delete" size={20} weight={500} />
        </button>
      </div>

      <LastTimeLine suggestion={suggestion} />

      <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
        {([["strength", "Reps & weight"], ["cardio", "Time & distance"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            style={{
              minHeight: 36,
              padding: "0 var(--space-3)",
              borderRadius: "var(--radius-pill)",
              cursor: "pointer",
              transition: "var(--transition-default)",
              border: `1px solid ${mode === value ? "var(--border-accent)" : "var(--border-default)"}`,
              background: mode === value ? "var(--accent-wash)" : "transparent",
              color: mode === value ? "var(--text-accent)" : "var(--text-faint)",
              font: "var(--weight-bold) var(--text-xs)/1 var(--font-sans)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {entry.sets.length > 0 ? (
        <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-1)" }}>
          {entry.sets.map((item, index) => (
            <SetLine
              key={item.id}
              number={index + 1}
              text={formatSetCompact(item.metrics) || "empty"}
              isEditing={editingSetId === item.id}
              onClick={() => toggleSetEditing(item.id)}
            />
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)" }}>
        {isCardio ? (
          <>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <MetricTile
                label="Time"
                value={draft.time}
                onChange={set("time")}
                step={TIME_STEP}
                unit={unitLabels[draft.timeUnit]}
                onCycleUnit={() => set("timeUnit")(cycle(timeUnits, draft.timeUnit))}
              />
              <MetricTile
                label="Distance"
                value={draft.distance}
                onChange={set("distance")}
                step={DISTANCE_STEP}
                unit={unitLabels[draft.distanceUnit]}
                onCycleUnit={() => set("distanceUnit")(cycle(distanceUnits, draft.distanceUnit))}
              />
            </div>
            <MetricTile label="Laps" value={draft.laps} onChange={set("laps")} step={LAP_STEP} />
          </>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <MetricTile label="Reps" value={draft.reps} onChange={set("reps")} step={REP_STEP} />
            <MetricTile
              label="Weight"
              value={draft.weight}
              onChange={set("weight")}
              step={WEIGHT_STEP}
              unit={unitLabels[draft.weightUnit]}
              onCycleUnit={() => set("weightUnit")(draft.weightUnit === "LB" ? "KG" : "LB")}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {editingSetId ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onDeleteSet(editingSetId);
                  setEditingSetId(null);
                }}
                style={{
                  height: "var(--control-field)",
                  padding: "0 var(--space-5)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  font: "var(--weight-bold) var(--text-base)/1 var(--font-sans)",
                  cursor: "pointer",
                  transition: "var(--transition-default)",
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={!canCommit}
                style={{
                  flex: 1,
                  height: "var(--control-field)",
                  padding: "0 var(--space-5)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid transparent",
                  background: canCommit ? "var(--accent)" : "var(--zinc-700)",
                  color: canCommit ? "var(--text-on-accent)" : "var(--zinc-400)",
                  font: "var(--weight-black) var(--text-base)/1 var(--font-sans)",
                  cursor: canCommit ? "pointer" : "not-allowed",
                  transition: "var(--transition-default)",
                }}
              >
                Save set {editingSetIndex + 1}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={commit}
              disabled={!canCommit}
              style={{
                width: "100%",
                height: "var(--control-hero)",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-xl)",
                border: "1px solid transparent",
                background: canCommit ? "var(--accent)" : "var(--zinc-700)",
                color: canCommit ? "var(--text-on-accent)" : "var(--zinc-400)",
                font: "var(--weight-black) var(--text-lg)/1 var(--font-sans)",
                cursor: canCommit ? "pointer" : "not-allowed",
                transition: "var(--transition-default)",
              }}
            >
              Log set {entry.sets.length + 1}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
