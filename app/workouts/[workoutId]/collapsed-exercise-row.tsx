"use client";

import { summarizeSets } from "@/lib/workout-metrics";
import type { WorkoutSnapshot } from "@/lib/workout-sync-types";

type CollapsedExerciseRowProps = {
  entry: WorkoutSnapshot["exercises"][number];
  onClick: () => void;
};

/** An exercise that is not in focus: one tappable line. */
export function CollapsedExerciseRow({ entry, onClick }: CollapsedExerciseRowProps) {
  // A set-less exercise blocks Finish, so it gets a caution border to explain why.
  const needsEntry = entry.sets.length === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 56,
        textAlign: "left",
        padding: "0 var(--space-4)",
        cursor: "pointer",
        transition: "var(--transition-default)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-card)",
        border: `1px solid ${needsEntry ? "var(--border-caution)" : "var(--border-default)"}`,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.exercise.name}
      </span>
      <span
        style={{
          flexShrink: 0,
          font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
          color: needsEntry ? "var(--text-caution)" : "var(--text-faint)",
        }}
      >
        {summarizeSets(entry.sets)}
      </span>
    </button>
  );
}
