import { type ExerciseMode, formatLastUsed, formatWeight } from "@/lib/workout-metrics";

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

/**
 * Typeahead for every place that picks an exercise by name: the add-exercise
 * panel and the routine builder. Under two characters it just offers the top of
 * the list, since ranking one letter is noise.
 */
export function matchSuggestions(
  suggestions: ExerciseSuggestion[],
  query: string,
  options: { exclude?: string[]; limit?: number } = {},
) {
  const normalizedQuery = query.trim().toLowerCase();
  const excluded = new Set((options.exclude ?? []).map((name) => name.trim().toLowerCase()));
  const available = excluded.size > 0
    ? suggestions.filter((suggestion) => !excluded.has(suggestion.name.toLowerCase()))
    : suggestions;

  if (normalizedQuery.length < 2) {
    return available.slice(0, options.limit ?? 3);
  }

  return available
    .filter((suggestion) => {
      const name = suggestion.name.toLowerCase();

      return name.includes(normalizedQuery) && name !== normalizedQuery;
    })
    // A prefix match is what the user is most likely typing towards.
    .sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(normalizedQuery);
      const bStartsWith = b.name.toLowerCase().startsWith(normalizedQuery);

      if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;

      return available.indexOf(a) - available.indexOf(b);
    })
    .slice(0, options.limit ?? 4);
}

/** The one-line history hint under an exercise name: "Last start 135 lb · 6d ago". */
export function describeSuggestion(suggestions: ExerciseSuggestion[], name: string, variant = "") {
  const suggestion = findSuggestion(suggestions, name);

  if (!suggestion) return "New to you";

  const startingWeight = findStartingWeight(suggestions, name, variant);

  if (startingWeight) {
    return `Last start ${formatWeight(startingWeight.value, startingWeight.unit)} · ${formatLastUsed(startingWeight.lastUsedAt)}`;
  }

  return `Used ${suggestion.usageCount}x · ${formatLastUsed(suggestion.lastUsedAt)}`;
}
