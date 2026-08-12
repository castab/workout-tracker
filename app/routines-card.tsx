import Link from "next/link";
import { Icon } from "@/app/material-icon";
import { startRoutineWorkoutAction } from "@/app/routines/actions";

type RoutineSummary = {
  id: string;
  name: string;
  note: string;
  itemCount: number;
};

/**
 * Saved plans on the home screen. Tapping one starts a workout with its
 * exercises copied in as a checklist — see WorkoutPlanItem in the schema.
 */
export function RoutinesCard({ routines }: { routines: RoutineSummary[] }) {
  return (
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
          <h2 style={{ font: "var(--type-section)" }}>Routines</h2>
          <p className="mt-1" style={{ font: "var(--type-body)", color: "var(--text-muted)" }}>
            Plan it once, then pick exercises off the list at the gym.
          </p>
        </div>

        <Link
          href="/routines/new"
          aria-label="New routine"
          title="New routine"
          className="grid shrink-0 place-items-center"
          style={{
            width: "var(--control-lg)",
            height: "var(--control-lg)",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-inverse)",
            color: "var(--text-on-accent)",
            transition: "var(--transition-default)",
          }}
        >
          <Icon name="add" size={22} weight={700} />
        </Link>
      </div>

      {routines.length === 0 ? (
        <div
          className="border border-dashed p-6 text-center"
          style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-strong)" }}
        >
          <p style={{ margin: 0, font: "var(--type-body-strong)", color: "var(--text-secondary)" }}>
            No routines yet.
          </p>
          <p style={{ margin: "var(--space-1) 0 0", font: "var(--type-body)", color: "var(--text-faint)" }}>
            Build one and every new workout can follow it.
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gap: "var(--space-3)" }}>
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="flex items-center"
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
              <Link href={`/routines/${routine.id}`} className="min-w-0 flex-1">
                <p style={{ margin: 0, font: "var(--weight-black) var(--text-base)/1.3 var(--font-sans)" }}>
                  {routine.name}
                </p>
                <p
                  style={{
                    margin: "var(--space-1) 0 0",
                    font: "var(--weight-semibold) var(--text-xs)/1 var(--font-mono)",
                    color: "var(--text-faint)",
                  }}
                >
                  {routine.itemCount} {routine.itemCount === 1 ? "exercise" : "exercises"}
                  {routine.note ? ` · ${routine.note}` : ""}
                </p>
              </Link>

              <form action={startRoutineWorkoutAction.bind(null, routine.id)} className="shrink-0">
                <button
                  className="grid place-items-center"
                  aria-label={`Start ${routine.name}`}
                  title={`Start ${routine.name}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--border-accent-soft)",
                    background: "var(--accent-wash)",
                    color: "var(--text-accent)",
                    cursor: "pointer",
                    transition: "var(--transition-default)",
                  }}
                >
                  <Icon name="play_arrow" size={20} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
