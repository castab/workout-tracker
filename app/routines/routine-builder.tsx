"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/app/material-icon";
import {
  type RoutineInput,
  type RoutineItemInput,
  deleteRoutineAction,
  saveAndStartRoutineAction,
  saveRoutineAction,
} from "@/app/routines/actions";
import { type ExerciseSuggestion, describeSuggestion, matchSuggestions } from "@/lib/workout-suggestions";

type RoutineBuilderProps = {
  routine?: {
    id: string;
    name: string;
    note: string;
    items: RoutineItemInput[];
  };
  suggestions: ExerciseSuggestion[];
};

const defaultTarget = "3 × 10";

const fieldStyle = {
  width: "100%",
  minWidth: 0,
  height: "var(--control-field)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border-strong)",
  background: "var(--surface-sunken)",
  padding: "0 var(--space-4)",
  font: "var(--weight-regular) var(--text-base)/1 var(--font-sans)",
  color: "var(--text-primary)",
  outline: "none",
  transition: "var(--transition-default)",
} as const;

const cardStyle = {
  borderRadius: "var(--radius-xl)",
  border: "1px solid var(--border-default)",
  background: "var(--surface-card)",
  padding: "var(--card-p)",
} as const;

const labelStyle = {
  display: "block",
  font: "var(--type-eyebrow)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-eyebrow-sm)",
  color: "var(--text-faint)",
  marginBottom: "var(--space-2)",
} as const;

/**
 * Builds the plan you pick from at the gym. Order here is a suggestion only —
 * nothing in the active workout enforces it, so this screen deliberately has no
 * reordering affordance to imply otherwise.
 */
export function RoutineBuilder({ routine, suggestions }: RoutineBuilderProps) {
  const [name, setName] = useState(routine?.name ?? "");
  const [note, setNote] = useState(routine?.note ?? "");
  const [items, setItems] = useState<RoutineItemInput[]>(routine?.items ?? []);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const matches = matchSuggestions(suggestions, query, {
    exclude: items.map((item) => item.name),
    limit: 4,
  });
  const canSave = items.length > 0 && !isPending;

  function draft(): RoutineInput {
    return { id: routine?.id, name, note, items };
  }

  function add(nextName: string, variant = "") {
    const trimmed = nextName.trim();

    if (!trimmed) return;
    if (items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      setQuery("");
      return;
    }

    setItems((current) => [...current, { name: trimmed, variant, target: defaultTarget }]);
    setQuery("");
  }

  function patch(index: number, update: Partial<RoutineItemInput>) {
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...update } : item)));
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
        <header>
          <div className="flex items-center justify-between" style={{ gap: "var(--space-3)", minHeight: 44 }}>
            <Link
              href="/"
              aria-label="Back to workouts"
              title="Back to workouts"
              className="grid shrink-0 place-items-center"
              style={{
                width: "var(--control-lg)",
                height: "var(--control-lg)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--border-strong)",
                color: "var(--zinc-200)",
                transition: "var(--transition-default)",
              }}
            >
              <Icon name="arrow_back" size={22} />
            </Link>

            <button
              type="button"
              disabled={!canSave}
              onClick={() => startTransition(() => saveRoutineAction(draft()))}
              style={{
                height: 44,
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid transparent",
                background: canSave ? "var(--accent)" : "var(--zinc-700)",
                color: canSave ? "var(--text-on-accent)" : "var(--zinc-400)",
                font: "var(--weight-black) var(--text-sm)/1 var(--font-sans)",
                cursor: canSave ? "pointer" : "not-allowed",
                transition: "var(--transition-default)",
              }}
            >
              Save
            </button>
          </div>

          <h1 className="mt-3" style={{ font: "var(--type-display)", letterSpacing: "var(--tracking-tight)" }}>
            {routine ? "Edit routine" : "New routine"}
          </h1>
          <p className="mt-2" style={{ font: "var(--type-body-strong)", color: "var(--text-faint)" }}>
            Order is a suggestion. At the gym you pick whatever is free.
          </p>
        </header>

        <section style={cardStyle}>
          <div className="grid" style={{ gap: "var(--space-4)" }}>
            <div>
              <label htmlFor="routine-name" style={labelStyle}>Name</label>
              <input
                id="routine-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Push day"
                autoComplete="off"
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="routine-note" style={labelStyle}>Note</label>
              <input
                id="routine-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Chest, shoulders, triceps"
                autoComplete="off"
                style={fieldStyle}
              />
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={{ font: "var(--type-section)" }}>Exercises</h2>
          <p className="mt-1" style={{ font: "var(--type-body)", color: "var(--text-muted)" }}>
            Target sets and reps show up while you log.
          </p>

          {items.length === 0 ? (
            <div
              className="mt-4 border border-dashed p-6 text-center"
              style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-strong)" }}
            >
              <p style={{ margin: 0, font: "var(--type-body-strong)", color: "var(--text-secondary)" }}>
                Nothing in this routine.
              </p>
              <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)", color: "var(--text-faint)" }}>
                Add the exercises you want to see at the gym.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid" style={{ gap: "var(--space-2)" }}>
              {items.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center"
                  style={{
                    gap: "var(--space-3)",
                    minHeight: 56,
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate"
                      style={{ margin: 0, font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)" }}
                    >
                      {item.name}
                    </p>
                    <p
                      style={{
                        margin: "var(--space-1) 0 0",
                        font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
                        color: "var(--text-faint)",
                      }}
                    >
                      {describeSuggestion(suggestions, item.name, item.variant)}
                    </p>
                  </div>

                  <input
                    value={item.target}
                    onChange={(event) => patch(index, { target: event.target.value })}
                    placeholder={defaultTarget}
                    aria-label={`Target for ${item.name}`}
                    style={{
                      width: 84,
                      flexShrink: 0,
                      height: 44,
                      textAlign: "center",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-chip)",
                      color: "var(--text-primary)",
                      font: "var(--weight-bold) var(--text-base)/1 var(--font-mono)",
                      outline: "none",
                      padding: 0,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((_, position) => position !== index))}
                    aria-label={`Remove ${item.name}`}
                    title={`Remove ${item.name}`}
                    className="grid shrink-0 place-items-center"
                    style={{
                      width: 36,
                      height: 36,
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
              ))}
            </div>
          )}

          <form
            className="mt-4 flex"
            style={{ gap: "var(--space-2)" }}
            onSubmit={(event) => {
              event.preventDefault();
              add(query);
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Bench Press"
              autoComplete="off"
              aria-label="Exercise name"
              style={{ ...fieldStyle, flex: 1 }}
            />
            <button
              type="submit"
              style={{
                flexShrink: 0,
                height: "var(--control-field)",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid transparent",
                background: "var(--accent)",
                color: "var(--text-on-accent)",
                font: "var(--weight-black) var(--text-base)/1 var(--font-sans)",
                cursor: "pointer",
                transition: "var(--transition-default)",
              }}
            >
              Add
            </button>
          </form>

          {matches.length > 0 ? (
            <div className="mt-3 grid" style={{ gap: "var(--space-1)" }}>
              {matches.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => add(suggestion.name)}
                  className="flex w-full items-center justify-between text-left"
                  style={{
                    minHeight: "var(--control-field)",
                    gap: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "transparent",
                    padding: "0 var(--space-3)",
                    cursor: "pointer",
                    transition: "var(--transition-default)",
                  }}
                >
                  <span style={{ font: "var(--weight-bold) var(--text-base)/1.3 var(--font-sans)", color: "var(--zinc-100)" }}>
                    {suggestion.name}
                  </span>
                  <span
                    className="shrink-0"
                    style={{ font: "var(--weight-semibold) var(--text-xs)/1 var(--font-sans)", color: "var(--text-faint)" }}
                  >
                    {describeSuggestion(suggestions, suggestion.name)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => startTransition(() => saveAndStartRoutineAction(draft()))}
          style={{
            width: "100%",
            height: "var(--control-hero)",
            padding: "0 var(--space-5)",
            borderRadius: "var(--radius-xl)",
            border: `1px solid ${canSave ? "var(--border-strong)" : "transparent"}`,
            background: "transparent",
            color: canSave ? "var(--text-secondary)" : "var(--zinc-600)",
            font: "var(--weight-black) var(--text-lg)/1 var(--font-sans)",
            cursor: canSave ? "pointer" : "not-allowed",
            transition: "var(--transition-default)",
          }}
        >
          Save and start now
        </button>

        {routine ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => deleteRoutineAction(routine.id))}
            style={{
              width: "100%",
              height: "var(--control-field)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid color-mix(in srgb, var(--red-400) 40%, transparent)",
              background: "transparent",
              color: "var(--red-200)",
              font: "var(--weight-bold) var(--text-base)/1 var(--font-sans)",
              cursor: isPending ? "not-allowed" : "pointer",
              transition: "var(--transition-default)",
            }}
          >
            Delete routine
          </button>
        ) : null}
      </div>
    </main>
  );
}
