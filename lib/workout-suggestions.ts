import type { ExerciseMode } from "@/lib/workout-metrics";

export type StartingWeight = {
  value: string;
  unit: "LB" | "KG";
  variant: string;
  lastUsedAt: string;
};

/**
 * The most recent time this exercise was performed, in a form the "Last time"
 * line can render without another round trip.
 */
export type LastSession = {
  performedAt: string;
  mode: ExerciseMode;
  /** Compact per-set strings, e.g. ["10 × 135", "10 × 135", "8 × 145"]. */
  setSummaries: string[];
};

export type ExerciseSuggestion = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string;
  startingWeights: StartingWeight[];
  lastSession: LastSession | null;
};

const weightUnits: StartingWeight["unit"][] = ["LB", "KG"];

export function isWeightUnit(unit: string): unit is StartingWeight["unit"] {
  return weightUnits.includes(unit as StartingWeight["unit"]);
}

export { weightUnits };

/** Prefers an exact variant match, then the variant-less entry, then anything. */
export function findStartingWeight(suggestions: ExerciseSuggestion[], name: string, variant: string) {
  const suggestion = findSuggestion(suggestions, name);

  if (!suggestion) return null;

  const normalizedVariant = variant.trim().toLowerCase();

  if (normalizedVariant) {
    return (
      suggestion.startingWeights.find((item) => item.variant.toLowerCase() === normalizedVariant)
      ?? suggestion.startingWeights.find((item) => item.variant === "")
      ?? suggestion.startingWeights[0]
      ?? null
    );
  }

  return suggestion.startingWeights.find((item) => item.variant === "") ?? suggestion.startingWeights[0] ?? null;
}

export function findSuggestion(suggestions: ExerciseSuggestion[], name: string) {
  const normalized = name.trim().toLowerCase();

  return suggestions.find((item) => item.name.toLowerCase() === normalized) ?? null;
}
