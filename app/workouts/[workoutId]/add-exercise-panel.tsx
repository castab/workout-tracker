"use client";

import { useRef, useState } from "react";
import { Icon } from "@/app/material-icon";
import { formatLastUsed, formatWeight } from "@/lib/workout-metrics";
import { type ExerciseSuggestion, findStartingWeight } from "@/lib/workout-suggestions";

type AddExercisePanelProps = {
  suggestions: ExerciseSuggestion[];
  onAdd: (name: string) => void;
  /** Suggestions come from the last online page load and are empty in preview mode. */
  suggestionsUnavailable?: boolean;
};

function suggestionMeta(suggestions: ExerciseSuggestion[], suggestion: ExerciseSuggestion) {
  const startingWeight = findStartingWeight(suggestions, suggestion.name, "");

  if (startingWeight) {
    return `Last start ${formatWeight(startingWeight.value, startingWeight.unit)} · ${formatLastUsed(startingWeight.lastUsedAt)}`;
  }

  return `Used ${suggestion.usageCount}x · ${formatLastUsed(suggestion.lastUsedAt)}`;
}

/**
 * Collapsed to a single button until tapped — the add flow is the least-used part
 * of this screen and should not compete with the entry pad for space.
 */
export function AddExercisePanel({ suggestions, onAdd, suggestionsUnavailable }: AddExercisePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const query = name.trim().toLowerCase();
  const matches = query.length >= 2
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
        .slice(0, 4)
    : suggestions.slice(0, 3);

  function add(nextName: string) {
    const trimmed = nextName.trim();

    if (!trimmed) return;

    onAdd(trimmed);
    setName("");
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          width: "100%",
          height: "var(--control-field)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-strong)",
          background: "transparent",
          color: "var(--text-secondary)",
          font: "var(--weight-bold) var(--text-base)/1 var(--font-sans)",
          cursor: "pointer",
          transition: "var(--transition-default)",
        }}
      >
        <Icon name="add" size={20} />
        Add exercise
      </button>
    );
  }

  return (
    <section
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span
          style={{
            font: "var(--type-eyebrow)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow-sm)",
            color: "var(--text-faint)",
          }}
        >
          Add exercise
        </span>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setName("");
          }}
          style={{
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-strong)",
            background: "transparent",
            color: "var(--text-secondary)",
            padding: "var(--space-2) var(--space-4)",
            font: "var(--weight-bold) var(--text-sm)/1 var(--font-sans)",
            cursor: "pointer",
            transition: "var(--transition-default)",
          }}
        >
          Cancel
        </button>
      </div>

      <form
        style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}
        onSubmit={(event) => {
          event.preventDefault();
          add(name);
        }}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Bench Press"
          autoComplete="off"
          aria-label="Exercise name"
          required
          style={{
            flex: 1,
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
          }}
        />
        <button
          type="submit"
          style={{
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
        <div style={{ marginTop: "var(--space-3)", display: "grid", gap: "var(--space-1)" }}>
          {matches.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => add(suggestion.name)}
              style={{
                display: "flex",
                minHeight: "var(--control-field)",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "transparent",
                padding: "0 var(--space-3)",
                textAlign: "left",
                cursor: "pointer",
                transition: "var(--transition-default)",
              }}
            >
              <span style={{ font: "var(--weight-bold) var(--text-base)/1.3 var(--font-sans)", color: "var(--zinc-100)" }}>
                {suggestion.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  font: "var(--weight-semibold) var(--text-xs)/1 var(--font-sans)",
                  color: "var(--text-faint)",
                }}
              >
                {suggestionMeta(suggestions, suggestion)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {suggestionsUnavailable ? (
        <p style={{ margin: "var(--space-3) 0 0", font: "var(--text-xs)/1.25rem var(--font-sans)", color: "var(--text-faint)" }}>
          Exercise suggestions are disabled in browser-only preview mode.
        </p>
      ) : null}
    </section>
  );
}
