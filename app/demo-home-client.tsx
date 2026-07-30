"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  getAllCachedWorkoutSnapshots,
  saveWorkoutSnapshot,
} from "@/app/workouts/[workoutId]/offline-workout-store";
import type { WorkoutSnapshot } from "@/lib/workout-sync-types";

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function setCount(workout: WorkoutSnapshot) {
  return workout.exercises.reduce((count, exercise) => count + exercise.sets.length, 0);
}

export function DemoHomeClient() {
  const [workouts, setWorkouts] = useState<WorkoutSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getAllCachedWorkoutSnapshots()
      .then((snapshots = []) => {
        if (!isMounted) return;

        setWorkouts(snapshots.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function createWorkout() {
    const workout: WorkoutSnapshot = {
      id: createId("demo-workout"),
      startedAt: new Date().toISOString(),
      endedAt: null,
      exercises: [],
    };

    await saveWorkoutSnapshot(workout);
    window.location.href = `/workouts/${workout.id}`;
  }

  const activeWorkout = workouts.find((workout) => !workout.endedAt);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <Card className="rounded-3xl border border-lime-300/30 bg-zinc-900 p-5 shadow-xl shadow-black/20 ring-0">
          <CardContent className="p-0">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
              Workout Tracker
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Branch preview mode</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This preview stores workouts only in this browser. No login, sessions, or database writes are used.
            </p>
          </CardContent>
        </Card>

        {activeWorkout ? (
          <Button
            asChild
            className="h-auto w-full flex-col items-start rounded-3xl p-5 text-left shadow-xl shadow-lime-950/20"
          >
            <Link href={`/workouts/${activeWorkout.id}`}>
              <p className="text-sm font-black uppercase tracking-[0.2em]">Active workout</p>
              <p className="mt-2 text-2xl font-black">Continue workout</p>
              <p className="mt-1 text-sm font-semibold">Started {formatDate(activeWorkout.startedAt)}</p>
            </Link>
          </Button>
        ) : (
          <Button
            className="h-16 w-full rounded-3xl text-lg font-black shadow-xl shadow-lime-950/20"
            onClick={() => void createWorkout()}
          >
            Start a new workout
          </Button>
        )}

        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
          <CardHeader className="mb-4 flex-row items-end justify-between gap-4 p-0">
            <div>
              <h2 className="text-xl font-black">Local workouts</h2>
              <p className="text-sm text-zinc-400">Saved in this browser&apos;s IndexedDB.</p>
            </div>

            {activeWorkout ? (
              <Button
                variant="secondary"
                size="icon"
                className="size-11 rounded-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                aria-label="New workout"
                title="New workout"
                onClick={() => void createWorkout()}
              >
                <Plus strokeWidth={2.5} />
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm font-semibold text-zinc-400">
                Loading local workouts...
              </p>
            ) : workouts.length === 0 ? (
              <Empty className="rounded-2xl border border-zinc-700 p-6">
                <EmptyTitle className="text-sm font-semibold text-zinc-300">No local workouts yet.</EmptyTitle>
                <EmptyDescription className="text-zinc-500">Start one to test the UI.</EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => (
                  <Link
                    href={`/workouts/${workout.id}`}
                    key={workout.id}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black">{formatDate(workout.startedAt)}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {workout.exercises.length} exercises - {setCount(workout)} sets
                        </p>
                      </div>

                      <Badge variant="secondary" className="text-xs font-bold">
                        {workout.endedAt ? "Done" : "Active"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
