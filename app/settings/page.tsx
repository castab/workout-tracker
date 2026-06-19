import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { changePasswordAction } from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  current: "Current password is incorrect.",
  match: "New passwords do not match.",
  missing: "All password fields are required.",
  short: "New password must be at least 12 characters.",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requireUser();

  const { error } = await searchParams;
  const message = error ? errorMessages[error] : null;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
          <Link
            href="/"
            className="text-sm font-bold text-lime-300 transition hover:text-lime-200"
          >
            Back to workouts
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Settings</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Change the password used to unlock Workout Tracker.
          </p>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Password</h2>

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {message}
            </div>
          ) : null}

          <form action={changePasswordAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-200">
                Current password
              </span>
              <input
                className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-zinc-200">New password</span>
              <input
                className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-zinc-200">
                Confirm new password
              </span>
              <input
                className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>

            <button className="h-14 w-full rounded-2xl bg-lime-300 px-5 text-base font-black text-zinc-950 transition hover:bg-lime-200">
              Change password
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
