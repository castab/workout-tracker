import Link from "next/link";
import { LogOut, Plus, Settings as SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { DemoHomeClient } from "@/app/demo-home-client";
import { isDemoMode } from "@/app/demo-mode";
import { logoutAction } from "@/app/login/actions";
import { LocalDateTime } from "@/app/local-date-time";
import { createWorkoutAction } from "@/app/workouts/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function WorkoutDate({ date }: { date: Date }) {
  return <LocalDateTime isoString={date.toISOString()} fallback={formatDate(date)} />;
}

export default async function Home() {
  if (isDemoMode()) {
    return <DemoHomeClient />;
  }

  const user = await requireUser();
  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 8,
    include: {
      exercises: {
        include: { sets: true },
      },
    },
  });

  const activeWorkout = workouts.find((workout) => !workout.endedAt);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20 ring-0">
          <CardContent className="flex items-start justify-between gap-4 p-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                Workout Tracker
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">
                Ready to train?
              </h1>
              <p className="mt-2 text-sm text-zinc-400">Password-protected access.</p>
              <p className="mt-1 text-sm font-semibold text-zinc-300">Signed in as {user.username}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-11 rounded-full border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-transparent"
              >
                <Link href="/settings" aria-label="Settings" title="Settings">
                  <SettingsIcon />
                </Link>
              </Button>

              <form action={logoutAction}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-transparent"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut />
                </Button>
              </form>
            </div>
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
              <p className="mt-1 text-sm font-semibold">
                Started <WorkoutDate date={activeWorkout.startedAt} />
              </p>
            </Link>
          </Button>
        ) : (
          <form action={createWorkoutAction}>
            <Button className="h-16 w-full rounded-3xl text-lg font-black shadow-xl shadow-lime-950/20">
              Start a new workout
            </Button>
          </form>
        )}

        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
          <CardHeader className="mb-4 flex-row items-end justify-between gap-4 p-0">
            <div>
              <h2 className="text-xl font-black">Recent workouts</h2>
              <p className="text-sm text-zinc-400">Your latest sessions and set counts.</p>
            </div>

            {activeWorkout ? (
              <form action={createWorkoutAction}>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-11 rounded-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                  aria-label="New workout"
                  title="New workout"
                >
                  <Plus strokeWidth={2.5} />
                </Button>
              </form>
            ) : null}
          </CardHeader>

          <CardContent className="p-0">
            {workouts.length === 0 ? (
              <Empty className="rounded-2xl border border-zinc-700 p-6">
                <EmptyTitle className="text-sm font-semibold text-zinc-300">No workouts yet.</EmptyTitle>
                <EmptyDescription className="text-zinc-500">Start one when you get to the gym.</EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => {
                  const setCount = workout.exercises.reduce(
                    (count, exercise) => count + exercise.sets.length,
                    0,
                  );

                  return (
                    <Link
                      href={`/workouts/${workout.id}`}
                      key={workout.id}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-600"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black"><WorkoutDate date={workout.startedAt} /></p>
                          <p className="mt-1 text-sm text-zinc-400">
                            {workout.exercises.length} exercises · {setCount} sets
                          </p>
                        </div>

                        <Badge variant="secondary" className="text-xs font-bold">
                          {workout.endedAt ? "Done" : "Active"}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
