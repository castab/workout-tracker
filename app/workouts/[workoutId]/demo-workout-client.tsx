"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfflineWorkoutClient } from "./offline-workout-client";
import { getCachedWorkoutSnapshot, saveWorkoutSnapshot } from "./offline-workout-store";
import type { WorkoutSnapshot } from "@/lib/workout-sync-types";

function createFallbackSnapshot(workoutId: string): WorkoutSnapshot {
  return {
    id: workoutId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    exercises: [],
  };
}

export function DemoWorkoutClient({ workoutId }: { workoutId: string }) {
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const cached = await getCachedWorkoutSnapshot(workoutId);
      const nextSnapshot = cached ?? createFallbackSnapshot(workoutId);

      if (!cached) {
        await saveWorkoutSnapshot(nextSnapshot);
      }

      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [workoutId]);

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
            <Link href="/" className="text-sm font-bold text-lime-300">← Back to workouts</Link>
            <h1 className="mt-5 text-3xl font-black tracking-tight">Loading local workout...</h1>
          </header>
        </div>
      </main>
    );
  }

  return <OfflineWorkoutClient initialSnapshot={snapshot} suggestions={[]} syncMode="local" />;
}
