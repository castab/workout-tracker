"use client";

import { type ReactNode, useState } from "react";
import { Icon } from "@/app/material-icon";
import { summarizeSets } from "@/lib/workout-metrics";
import type { WorkoutPlan, WorkoutPlanItem, WorkoutSnapshot } from "@/lib/workout-sync-types";

type WorkoutEntry = WorkoutSnapshot["exercises"][number];

type PlanPanelProps = {
  plan: WorkoutPlan;
  exercises: WorkoutEntry[];
  focusId: string | null;
  onPick: (item: WorkoutPlanItem) => void;
  onFocus: (workoutExerciseId: string) => void;
  /** The add-exercise panel, so off-plan additions live next to the plan. */
  addSlot: ReactNode;
};

const eyebrowStyle = {
  font: "var(--type-eyebrow)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-eyebrow-sm)",
  color: "var(--text-faint)",
} as const;

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  transition: "var(--transition-default)",
  borderRadius: "var(--radius-lg)",
} as const;

const metaStyle = {
  margin: "var(--space-1) 0 0",
  font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
} as const;

export function matchPlanItem(exercises: WorkoutEntry[], item: { name: string }) {
  const normalized = item.name.trim().toLowerCase();

  return exercises.find((entry) => entry.exercise.name.trim().toLowerCase() === normalized) ?? null;
}

/** Not yet added to the workout: one tap adds it and makes it the focus. */
function PickRow({ item, onPick }: { item: WorkoutPlanItem; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        ...rowStyle,
        minHeight: 56,
        padding: "var(--space-2) var(--space-3)",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)" }}>{item.name}</span>
          {item.target ? (
            <span style={{ font: "var(--weight-bold) var(--text-xs)/1 var(--font-mono)", color: "var(--text-accent)" }}>
              {item.target}
            </span>
          ) : null}
        </div>
        {item.variant ? <p style={{ ...metaStyle, color: "var(--text-faint)" }}>{item.variant}</p> : null}
      </div>

      <span
        className="grid shrink-0 place-items-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border-strong)",
          color: "var(--text-secondary)",
        }}
      >
        <Icon name="add" size={20} />
      </span>
    </button>
  );
}

/** Added but not logged yet — caution, because it still blocks Finish. */
function OpenRow({
  item,
  isCurrent,
  onClick,
}: {
  item: WorkoutPlanItem;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const accentColor = isCurrent ? "var(--text-accent)" : "var(--text-caution)";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? "true" : undefined}
      style={{
        ...rowStyle,
        minHeight: 56,
        padding: "var(--space-2) var(--space-3)",
        background: isCurrent ? "var(--accent-wash)" : "var(--caution-wash)",
        border: `1px solid ${isCurrent ? "var(--border-accent-soft)" : "var(--border-caution)"}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)" }}>{item.name}</span>
          {item.target ? (
            <span style={{ font: "var(--weight-bold) var(--text-xs)/1 var(--font-mono)", color: accentColor }}>
              {item.target}
            </span>
          ) : null}
        </div>
        <p style={{ ...metaStyle, color: accentColor }}>
          {isCurrent ? "Editing above · no sets yet" : "Added · no sets yet"}
        </p>
      </div>

      <span
        className="grid shrink-0 place-items-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-pill)",
          border: `1px solid ${isCurrent ? "var(--border-accent-soft)" : "var(--border-caution)"}`,
          color: accentColor,
        }}
      >
        <Icon name={isCurrent ? "arrow_upward" : "chevron_right"} size={20} />
      </span>
    </button>
  );
}

/** Has at least one set. Still tappable — editing a logged set is common. */
function DoneRow({
  item,
  summary,
  isCurrent,
  onClick,
}: {
  item: WorkoutPlanItem;
  summary: string;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? "true" : undefined}
      style={{
        ...rowStyle,
        minHeight: 48,
        padding: "0 var(--space-3)",
        background: isCurrent ? "var(--accent-wash)" : "var(--surface-sunken)",
        border: `1px solid ${isCurrent ? "var(--border-accent-soft)" : "var(--border-default)"}`,
      }}
    >
      <span className="flex shrink-0" style={{ color: "var(--text-accent)" }}>
        <Icon name={isCurrent ? "edit" : "check"} size={18} />
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        style={{
          font: "var(--weight-bold) var(--text-sm)/1.3 var(--font-sans)",
          color: isCurrent ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        {item.name}
      </span>
      <span
        className="shrink-0"
        style={{
          font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
          color: isCurrent ? "var(--text-accent)" : "var(--text-faint)",
        }}
      >
        {isCurrent ? "editing above" : summary}
      </span>
      <span className="flex shrink-0" style={{ color: isCurrent ? "var(--text-accent)" : "var(--text-faint)" }}>
        <Icon name={isCurrent ? "arrow_upward" : "chevron_right"} size={18} weight={500} />
      </span>
    </button>
  );
}

/**
 * The routine as a checklist. It never blocks logging — anything can be skipped,
 * and anything off-plan can be added — so this is a progress readout plus a
 * one-tap way to load the next movement into the entry pad.
 */
export function PlanPanel({ plan, exercises, focusId, onPick, onFocus, addSlot }: PlanPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const remaining: WorkoutPlanItem[] = [];
  const open: { item: WorkoutPlanItem; entry: WorkoutEntry }[] = [];
  const done: { item: WorkoutPlanItem; entry: WorkoutEntry }[] = [];

  for (const item of plan.items) {
    const entry = matchPlanItem(exercises, item);

    if (!entry) remaining.push(item);
    else if (entry.sets.length === 0) open.push({ item, entry });
    else done.push({ item, entry });
  }

  const percentComplete = plan.items.length > 0 ? Math.round((done.length / plan.items.length) * 100) : 0;

  return (
    <section
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-card-soft)",
        padding: "var(--card-p)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              font: "var(--type-eyebrow)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--text-accent)",
            }}
          >
            Plan
          </span>
          <h2 className="mt-2" style={{ font: "var(--type-section)" }}>{plan.name || "Routine"}</h2>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Show plan" : "Hide plan"}
          className="flex shrink-0 items-center"
          style={{
            gap: "var(--space-2)",
            minHeight: 36,
            padding: "0 var(--space-3)",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            font: "var(--weight-bold) var(--text-xs)/1 var(--font-mono)",
            cursor: "pointer",
            transition: "var(--transition-default)",
          }}
        >
          {done.length} / {plan.items.length}
          <Icon name={isCollapsed ? "expand_more" : "expand_less"} size={18} />
        </button>
      </div>

      <div
        className="mt-3"
        style={{ height: 4, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", overflow: "hidden" }}
      >
        <div
          style={{
            width: `${percentComplete}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "var(--transition-default)",
          }}
        />
      </div>

      {isCollapsed ? null : (
        <>
          {remaining.length > 0 || open.length > 0 ? (
            <div className="mt-4 grid" style={{ gap: "var(--space-2)" }}>
              <span style={eyebrowStyle}>{remaining.length > 0 ? "Pick what is free" : "Still open"}</span>
              {open.map(({ item, entry }) => (
                <OpenRow
                  key={item.id}
                  item={item}
                  isCurrent={entry.id === focusId}
                  onClick={() => onFocus(entry.id)}
                />
              ))}
              {remaining.map((item) => (
                <PickRow key={item.id} item={item} onPick={() => onPick(item)} />
              ))}
            </div>
          ) : (
            <div
              className="mt-4 border border-dashed p-6 text-center"
              style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-strong)" }}
            >
              <p style={{ margin: 0, font: "var(--type-body-strong)", color: "var(--text-secondary)" }}>
                Plan complete.
              </p>
              <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)", color: "var(--text-faint)" }}>
                Add anything else you want, or finish here.
              </p>
            </div>
          )}

          {done.length > 0 ? (
            <div className="mt-4 grid" style={{ gap: "var(--space-1)" }}>
              <span style={eyebrowStyle}>Logged · tap to edit</span>
              {done.map(({ item, entry }) => (
                <DoneRow
                  key={item.id}
                  item={item}
                  summary={summarizeSets(entry.sets)}
                  isCurrent={entry.id === focusId}
                  onClick={() => onFocus(entry.id)}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-4">{addSlot}</div>
        </>
      )}
    </section>
  );
}
