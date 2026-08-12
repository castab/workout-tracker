import "server-only";

import { prisma } from "@/lib/prisma";
import { deriveMode, formatMetricValue, formatSetCompact } from "@/lib/workout-metrics";
import {
  type ExerciseSuggestion,
  type LastSession,
  type StartingWeight,
  isWeightUnit,
} from "@/lib/workout-suggestions";
import type { OfflineMetric } from "@/lib/workout-sync-types";

type ExerciseSuggestionRow = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: Date;
};

/**
 * The user's exercise vocabulary from the last 90 days, with the weight they
 * last started at and a compact summary of the last session.
 *
 * `excludeWorkoutId` keeps the workout currently on screen out of its own
 * suggestions. The routine builder passes nothing, since no workout is open.
 */
export async function getExerciseSuggestions(
  userId: string,
  excludeWorkoutId?: string,
): Promise<ExerciseSuggestion[]> {
  // An empty string never matches a cuid, so the "no exclusion" case still uses
  // one query shape rather than branching the SQL.
  const excludedWorkoutId = excludeWorkoutId ?? "";
  const suggestions = await prisma.$queryRaw<ExerciseSuggestionRow[]>`
    SELECT
      e.id,
      e.name,
      COUNT(*)::int AS "usageCount",
      MAX(we."createdAt") AS "lastUsedAt"
    FROM "WorkoutExercise" we
    JOIN "Exercise" e ON e.id = we."exerciseId"
    JOIN "Workout" w ON w.id = we."workoutId"
    WHERE we."createdAt" >= NOW() - INTERVAL '90 days'
      AND w."userId" = ${userId}
      AND w.id <> ${excludedWorkoutId}
    GROUP BY e.id, e.name
    ORDER BY COUNT(*) DESC, MAX(we."createdAt") DESC, e.name ASC
    LIMIT 50
  `;

  const exerciseIds = suggestions.map((suggestion) => suggestion.id);

  if (exerciseIds.length === 0) {
    return [];
  }

  // One pass feeds both outputs: the starting-weight hints (deduped per
  // exercise+variant) and the "Last time" line (deduped per exercise).
  const historyRows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: {
        userId,
        id: { not: excludedWorkoutId },
      },
      sets: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      sets: {
        orderBy: { order: "asc" },
        include: { metrics: true },
      },
    },
  });

  const startingWeightsByExerciseId = new Map<string, StartingWeight[]>();
  const lastSessionByExerciseId = new Map<string, LastSession>();
  const seenExerciseVariants = new Set<string>();

  for (const entry of historyRows) {
    const metricsBySet: OfflineMetric[][] = entry.sets.map((set) =>
      set.metrics.map((item) => ({
        type: item.type,
        unit: item.unit,
        value: formatMetricValue(item.value),
      })),
    );

    // Rows are ordered newest-first, so the first hit per exercise is the most recent.
    if (!lastSessionByExerciseId.has(entry.exerciseId) && metricsBySet.length > 0) {
      lastSessionByExerciseId.set(entry.exerciseId, {
        performedAt: entry.createdAt.toISOString(),
        mode: deriveMode(metricsBySet[metricsBySet.length - 1]),
        setSummaries: metricsBySet.map(formatSetCompact).filter(Boolean),
      });
    }

    const firstWeightMetric = metricsBySet
      .flat()
      .find((item) => item.type === "WEIGHT" && isWeightUnit(item.unit));

    if (!firstWeightMetric || !isWeightUnit(firstWeightMetric.unit)) continue;

    const variant = entry.variant.trim();
    const key = `${entry.exerciseId}:${variant.toLowerCase()}`;

    if (seenExerciseVariants.has(key)) continue;

    seenExerciseVariants.add(key);

    const startingWeights = startingWeightsByExerciseId.get(entry.exerciseId) ?? [];

    startingWeights.push({
      value: firstWeightMetric.value,
      unit: firstWeightMetric.unit,
      variant,
      lastUsedAt: entry.createdAt.toISOString(),
    });

    startingWeightsByExerciseId.set(entry.exerciseId, startingWeights);
  }

  return suggestions.map((suggestion) => ({
    ...suggestion,
    lastUsedAt: suggestion.lastUsedAt.toISOString(),
    startingWeights: startingWeightsByExerciseId.get(suggestion.id) ?? [],
    lastSession: lastSessionByExerciseId.get(suggestion.id) ?? null,
  }));
}
