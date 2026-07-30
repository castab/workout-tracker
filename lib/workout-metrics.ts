import type { OfflineMetric } from "@/lib/workout-sync-types";

/**
 * An exercise is either reps-and-weight or time-and-distance. Nothing in the
 * schema records which, so it is derived from the metrics actually logged.
 */
export type ExerciseMode = "strength" | "cardio";

export type SetDraft = {
  reps: string;
  weight: string;
  weightUnit: "LB" | "KG";
  time: string;
  timeUnit: "SECONDS" | "MINUTES";
  distance: string;
  distanceUnit: "MILES" | "KM" | "METERS";
  laps: string;
};

export const emptyDraft: SetDraft = {
  reps: "",
  weight: "",
  weightUnit: "LB",
  time: "",
  timeUnit: "MINUTES",
  distance: "",
  distanceUnit: "MILES",
  laps: "",
};

export function metric(metrics: OfflineMetric[], type: OfflineMetric["type"]) {
  return metrics.find((item) => item.type === type);
}

/** Trailing ".00" comes from Prisma's Decimal(10,2); "10.50" stays as-is. */
export function formatMetricValue(value: { toString(): string }) {
  return value.toString().replace(/\.00$/, "");
}

/** Verbose form used in set rows and the completed-workout view: "10 reps", "135 lb". */
export function formatMetric(metric: { type: string; value: { toString(): string }; unit: string }) {
  const value = formatMetricValue(metric.value);

  if (metric.type === "REPS") return `${value} reps`;
  if (metric.type === "LAPS") return `${value} laps`;

  return `${value} ${metric.unit.toLowerCase()}`;
}

export function formatSetSummary(metrics: { type: string; value: { toString(): string }; unit: string }[]) {
  return metrics.map(formatMetric).join(" · ");
}

/** Abbreviations matching the unit chips on the entry pad. */
const shortUnits: Record<string, string> = {
  SECONDS: "sec",
  MINUTES: "min",
  MILES: "mi",
  KM: "km",
  METERS: "m",
  LB: "lb",
  KG: "kg",
};

function formatMetricCompact(item: OfflineMetric) {
  if (item.type === "LAPS") return `${item.value} laps`;

  return `${item.value} ${shortUnits[item.unit] ?? item.unit.toLowerCase()}`;
}

/**
 * Compact form for set rows and the "Last time" line, where several sets share
 * one line: "10 × 135" for strength, "12 min · 1.2 mi" for cardio.
 */
export function formatSetCompact(metrics: OfflineMetric[]) {
  if (deriveMode(metrics) === "cardio") {
    return metrics
      .filter((item) => item.type !== "REPS")
      .map(formatMetricCompact)
      .join(" · ");
  }

  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");

  if (reps && weight) return `${formatMetricValue(reps.value)} × ${formatMetricValue(weight.value)}`;

  return formatSetSummary(metrics);
}

export function formatLastUsed(lastUsedAt: string) {
  const daysAgo = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86_400_000);

  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 14) return `${daysAgo}d ago`;
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)}w ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(lastUsedAt));
}

export function formatWeight(value: string, unit: string) {
  return `${value} ${unit.toLowerCase()}`;
}

/** Cardio only when a time/distance/lap metric is present and reps are not. */
export function deriveMode(metrics: { type: string }[]): ExerciseMode {
  const hasReps = metrics.some((item) => item.type === "REPS");
  const hasCardio = metrics.some((item) => item.type === "TIME" || item.type === "DISTANCE" || item.type === "LAPS");

  return hasCardio && !hasReps ? "cardio" : "strength";
}

export function metricsToDraft(metrics: OfflineMetric[]): SetDraft {
  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");
  const time = metric(metrics, "TIME");
  const distance = metric(metrics, "DISTANCE");
  const laps = metric(metrics, "LAPS");

  return {
    reps: reps?.value ?? "",
    weight: weight?.value ?? "",
    weightUnit: (weight?.unit as SetDraft["weightUnit"]) ?? "LB",
    time: time?.value ?? "",
    timeUnit: (time?.unit as SetDraft["timeUnit"]) ?? "MINUTES",
    distance: distance?.value ?? "",
    distanceUnit: (distance?.unit as SetDraft["distanceUnit"]) ?? "MILES",
    laps: laps?.value ?? "",
  };
}

/**
 * Only the fields belonging to `mode` are persisted, so switching an exercise to
 * cardio does not carry a stale rep count along with it. SetMetric is unique on
 * (setId, type), so at most one metric per type may be returned.
 */
export function draftToMetrics(draft: SetDraft, mode: ExerciseMode): OfflineMetric[] {
  const candidates: (OfflineMetric | null)[] =
    mode === "cardio"
      ? [
          draft.time ? { type: "TIME", unit: draft.timeUnit, value: draft.time } : null,
          draft.distance ? { type: "DISTANCE", unit: draft.distanceUnit, value: draft.distance } : null,
          draft.laps ? { type: "LAPS", unit: "LAPS", value: draft.laps } : null,
        ]
      : [
          draft.reps ? { type: "REPS", unit: "COUNT", value: draft.reps } : null,
          draft.weight ? { type: "WEIGHT", unit: draft.weightUnit, value: draft.weight } : null,
        ];

  return candidates.filter((item): item is OfflineMetric => item !== null);
}

export function draftHasValue(draft: SetDraft, mode: ExerciseMode) {
  return draftToMetrics(draft, mode).length > 0;
}

/** Collapsed-row summary: "3 sets · top 145 lb", or "2 entries" for cardio. */
export function summarizeSets(sets: { metrics: OfflineMetric[] }[]) {
  if (sets.length === 0) return "No sets yet";

  const mode = deriveMode(sets[sets.length - 1].metrics);

  if (mode === "cardio") return `${sets.length} ${sets.length === 1 ? "entry" : "entries"}`;

  let topWeight = 0;
  let topUnit = "lb";

  for (const set of sets) {
    const weight = metric(set.metrics, "WEIGHT");

    if (!weight) continue;

    const value = Number(weight.value);

    if (Number.isFinite(value) && value > topWeight) {
      topWeight = value;
      topUnit = weight.unit.toLowerCase();
    }
  }

  const label = `${sets.length} ${sets.length === 1 ? "set" : "sets"}`;

  return topWeight > 0 ? `${label} · top ${topWeight} ${topUnit}` : label;
}
