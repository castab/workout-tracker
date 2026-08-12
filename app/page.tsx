import Link from "next/link";
import { DemoHomeClient } from "@/app/demo-home-client";
import { isDemoMode } from "@/app/demo-mode";
import { Icon } from "@/app/material-icon";
import { logoutAction } from "@/app/login/actions";
import { LocalDateTime } from "@/app/local-date-time";
import { RoutinesCard } from "@/app/routines-card";
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

const roundButton = {
  width: "var(--control-lg)",
  height: "var(--control-lg)",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--border-strong)",
  color: "var(--zinc-200)",
  transition: "var(--transition-default)",
} as const;

export default async function Home() {
  if (isDemoMode()) {
    return <DemoHomeClient />;
  }

  const user = await requireUser();
  const [workouts, routines] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: {
        exercises: {
          include: { sets: true },
        },
      },
    }),
    prisma.routine.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const activeWorkout = workouts.find((workout) => !workout.endedAt);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--surface-app)",
        color: "var(--text-primary)",
        padding: "var(--page-py) var(--page-px)",
      }}
    >
      <div
        className="mx-auto flex w-full flex-col"
        style={{ maxWidth: "var(--content-max)", gap: "var(--stack-gap)" }}
      >
        <header
          className="border p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            borderColor: "var(--border-default)",
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-bold uppercase"
                style={{ letterSpacing: "var(--tracking-eyebrow-lg)", color: "var(--text-accent)" }}
              >
                Workout Tracker
              </p>
              <h1 className="mt-3" style={{ font: "var(--type-display)", letterSpacing: "var(--tracking-tight)" }}>
                Ready to train?
              </h1>
              <p className="mt-2" style={{ font: "var(--type-body)", color: "var(--text-muted)" }}>
                Password-protected access.
              </p>
              <p className="mt-1" style={{ font: "var(--type-body-strong)", color: "var(--text-secondary)" }}>
                Signed in as {user.username}
              </p>
            </div>

            <div className="flex shrink-0 items-center" style={{ gap: "var(--space-2)" }}>
              <Link
                href="/settings"
                className="grid place-items-center"
                aria-label="Settings"
                title="Settings"
                style={roundButton}
              >
                <Icon name="settings" size={20} />
              </Link>

              <form action={logoutAction}>
                <button className="grid place-items-center" aria-label="Logout" title="Logout" style={roundButton}>
                  <Icon name="logout" size={20} />
                </button>
              </form>
            </div>
          </div>
        </header>

        {activeWorkout ? (
          <Link
            href={`/workouts/${activeWorkout.id}`}
            className="border p-5"
            style={{
              borderRadius: "var(--radius-xl)",
              borderColor: "var(--border-accent-soft)",
              background: "var(--accent)",
              color: "var(--text-on-accent)",
              boxShadow: "var(--shadow-accent)",
              transition: "var(--transition-default)",
            }}
          >
            <p
              className="text-sm font-black uppercase"
              style={{ letterSpacing: "var(--tracking-eyebrow-sm)" }}
            >
              Active workout
            </p>
            <p className="mt-2" style={{ font: "var(--weight-black) var(--text-2xl)/1.1 var(--font-sans)" }}>
              Continue workout
            </p>
            <p className="mt-1" style={{ font: "var(--type-body-strong)" }}>
              {activeWorkout.planName ? `${activeWorkout.planName} · started ` : "Started "}
              <WorkoutDate date={activeWorkout.startedAt} />
            </p>
          </Link>
        ) : (
          <form action={createWorkoutAction}>
            <button
              className="w-full"
              style={{
                height: "var(--control-hero)",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-xl)",
                border: "1px solid transparent",
                background: "var(--accent)",
                color: "var(--text-on-accent)",
                font: "var(--weight-black) var(--text-lg)/1 var(--font-sans)",
                boxShadow: "var(--shadow-accent)",
                cursor: "pointer",
                transition: "var(--transition-default)",
              }}
            >
              Start a new workout
            </button>
          </form>
        )}

        <RoutinesCard
          routines={routines.map((routine) => ({
            id: routine.id,
            name: routine.name,
            note: routine.note,
            itemCount: routine._count.items,
          }))}
        />

        <section
          className="border p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            borderColor: "var(--border-default)",
            background: "var(--surface-card)",
          }}
        >
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 style={{ font: "var(--type-section)" }}>Recent workouts</h2>
              <p className="mt-1" style={{ font: "var(--type-body)", color: "var(--text-muted)" }}>
                Your latest sessions and set counts.
              </p>
            </div>

            {activeWorkout ? (
              <form action={createWorkoutAction}>
                <button
                  className="grid shrink-0 place-items-center"
                  aria-label="New workout"
                  title="New workout"
                  style={{
                    width: "var(--control-lg)",
                    height: "var(--control-lg)",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--surface-inverse)",
                    color: "var(--text-on-accent)",
                    cursor: "pointer",
                    transition: "var(--transition-default)",
                  }}
                >
                  <Icon name="add" size={22} weight={700} />
                </button>
              </form>
            ) : null}
          </div>

          {workouts.length === 0 ? (
            <div
              className="border border-dashed p-6 text-center"
              style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-strong)" }}
            >
              <p style={{ margin: 0, font: "var(--type-body-strong)", color: "var(--text-secondary)" }}>
                No workouts yet.
              </p>
              <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)", color: "var(--text-faint)" }}>
                Start one when you get to the gym.
              </p>
            </div>
          ) : (
            <div className="grid" style={{ gap: "var(--space-3)" }}>
              {workouts.map((workout) => {
                const setCount = workout.exercises.reduce(
                  (count, exercise) => count + exercise.sets.length,
                  0,
                );
                const isActive = !workout.endedAt;

                return (
                  <Link
                    href={`/workouts/${workout.id}`}
                    key={workout.id}
                    className="flex items-center justify-between"
                    style={{
                      gap: "var(--space-3)",
                      minHeight: 56,
                      padding: "var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--border-default)",
                      transition: "var(--transition-default)",
                    }}
                  >
                    <div className="min-w-0">
                      <p style={{ margin: 0, font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)" }}>
                        <WorkoutDate date={workout.startedAt} />
                      </p>
                      <p
                        style={{
                          margin: "var(--space-1) 0 0",
                          font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
                          color: "var(--text-faint)",
                        }}
                      >
                        {workout.exercises.length} exercises · {setCount} sets
                        {workout.planName ? ` · ${workout.planName}` : ""}
                      </p>
                    </div>

                    <span
                      className="shrink-0"
                      style={{
                        borderRadius: "var(--radius-pill)",
                        padding: "var(--space-1) var(--space-3)",
                        border: `1px solid ${isActive ? "var(--border-accent-soft)" : "transparent"}`,
                        background: isActive ? "var(--accent-wash)" : "var(--surface-chip)",
                        color: isActive ? "var(--text-accent)" : "var(--text-secondary)",
                        font: "var(--weight-bold) var(--text-xs)/1rem var(--font-sans)",
                      }}
                    >
                      {isActive ? "Active" : "Done"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
