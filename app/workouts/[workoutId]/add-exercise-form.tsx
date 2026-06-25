"use client";

import { useRef, useState } from "react";

export type ExerciseSuggestion = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string;
  startingWeights: {
    value: string;
    unit: "LB" | "KG";
    variant: string;
    lastUsedAt: string;
  }[];
};

type AddExerciseFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  suggestions: ExerciseSuggestion[];
};

function formatLastUsed(lastUsedAt: string) {
  const daysAgo = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86_400_000);

  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 14) return `${daysAgo}d ago`;
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)}w ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(lastUsedAt));
}

function formatWeight(value: string, unit: string) {
  return `${value} ${unit.toLowerCase()}`;
}

export function AddExerciseForm({ action, suggestions }: AddExerciseFormProps) {
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = name.trim().toLowerCase();
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

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-3">
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

      {matches.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Suggestions
          </p>
          <div className="space-y-1">
            {matches.map((suggestion) => {
              const startingWeight = suggestion.startingWeights[0];

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
                  onClick={() => {
                    setName(suggestion.name);

                    if (inputRef.current) {
                      inputRef.current.value = suggestion.name;
                    }

                    formRef.current?.requestSubmit();
                  }}
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
    </form>
  );
}
