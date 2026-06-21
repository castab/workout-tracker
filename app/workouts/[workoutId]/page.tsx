import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { LocalDateTime } from "@/app/local-date-time";
import type { ExerciseSuggestion } from "@/app/workouts/[workoutId]/add-exercise-form";
import { OfflineWorkoutClient } from "@/app/workouts/[workoutId]/offline-workout-client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeWorkoutSnapshot } from "@/lib/workout-snapshot";

export const dynamic = "force-dynamic";

type WorkoutPageProps = {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ focusExercise?: string | string[]; finishError?: string | string[] }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function WorkoutDate({ date }: { date: Date }) {
  return <LocalDateTime isoString={date.toISOString()} fallback={formatDate(date)} weekday="short" />;
}

function formatMetricValue(value: { toString(): string }) {
  return value.toString().replace(/\.00$/, "");
}

function formatMetric(metric: { type: string; value: { toString(): string }; unit: string }) {
  const value = formatMetricValue(metric.value);

  if (metric.type === "REPS") return `${value} reps`;
  if (metric.type === "WEIGHT") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "TIME") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "DISTANCE") return `${value} ${metric.unit.toLowerCase()}`;
  if (metric.type === "LAPS") return `${value} laps`;

  return `${value} ${metric.unit.toLowerCase()}`;
}

type ExerciseSuggestionRow = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: Date;
};

async function getExerciseSuggestions(userId: string): Promise<ExerciseSuggestion[]> {
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
    GROUP BY e.id, e.name
    ORDER BY COUNT(*) DESC, MAX(we."createdAt") DESC, e.name ASC
    LIMIT 50
  `;

  return suggestions.map((suggestion) => ({
    ...suggestion,
    lastUsedAt: suggestion.lastUsedAt.toISOString(),
  }));
}

export default async function WorkoutPage({ params, searchParams }: WorkoutPageProps) {
  const user = await requireUser();

  const { workoutId } = await params;
  const resolvedSearchParams = await searchParams;
  const focusedExercise = resolvedSearchParams.focusExercise;
  const focusedExerciseId = Array.isArray(focusedExercise) ? focusedExercise[0] : focusedExercise;
  const finishError = Array.isArray(resolvedSearchParams.finishError)
    ? resolvedSearchParams.finishError[0]
    : resolvedSearchParams.finishError;
  const [workout, exerciseSuggestions] = await Promise.all([
    prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: {
          orderBy: { order: "desc" },
          include: {
            exercise: true,
            sets: {
              orderBy: { order: "asc" },
              include: { metrics: true },
            },
          },
        },
      },
    }),
    getExerciseSuggestions(user.id),
  ]);

  if (!workout || workout.userId !== user.id) {
    notFound();
  }

  const isActiveWorkout = !workout.endedAt;
  const canFinishWorkout = workout.exercises.length > 0 && workout.exercises.every((exercise) => exercise.sets.length > 0);
  const showFinishError = isActiveWorkout && finishError === "missingEntries";

  if (isActiveWorkout) {
    return (
      <OfflineWorkoutClient
        initialSnapshot={serializeWorkoutSnapshot(workout)}
        suggestions={exerciseSuggestions}
        focusedExerciseId={focusedExerciseId}
        finishError={finishError}
      />
    );
  }

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", py: 2.5 }}>
      <Container maxWidth="sm" disableGutters sx={{ px: 2 }}>
        <Stack spacing={2.5}>
          <Card component="header">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Button href="/" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>
                Back to workouts
              </Button>
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}><WorkoutDate date={workout.startedAt} /></Typography>
                <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
                  {workout.endedAt ? "Workout complete" : "Active workout"}
                </Typography>
              </Box>
              {isActiveWorkout && !canFinishWorkout ? (
                <Alert severity="warning" sx={{ mt: 2.5 }}>
                  <Typography sx={{ fontWeight: 900 }}>{showFinishError ? "Workout not finished." : "Finish locked for now."}</Typography>
                  Add at least one exercise and at least one entry for every exercise before finishing.
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Alert severity="info">
            <Typography sx={{ fontWeight: 900 }}>Workout locked</Typography>
            Completed workouts are read-only so the recorded history stays intact.
          </Alert>

          {workout.exercises.length === 0 ? (
            <Box component="section" sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, p: 4, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 900 }}>No exercises yet.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>This workout has no exercises.</Typography>
            </Box>
          ) : (
            workout.exercises.map((entry) => (
              <Card component="section" key={entry.id} id={`exercise-${entry.id}`}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.25em" }}>
                    Exercise {entry.order + 1}
                  </Typography>
                  <Typography variant="h5" component="h2" sx={{ mt: 1 }}>
                    {entry.exercise.name}
                  </Typography>
                  {entry.sets.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 2.5 }}>
                      {entry.sets.map((set) => {
                        const summary = set.metrics.map(formatMetric).join(" · ");

                        return (
                          <Box key={set.id} sx={{ bgcolor: "background.default", borderRadius: 3, p: 1.5 }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.2em" }}>
                              Set {set.order + 1}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{summary}</Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Container>
    </Box>
  );
}
