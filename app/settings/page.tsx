import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { minimumPasswordLength } from "@/lib/users";
import {
  changePasswordAction,
  createUserAction,
  transferAdminAction,
  updateOwnUsernameAction,
  updateUserUsernameAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  admin: "Admin access is required.",
  current: "Current password is incorrect.",
  duplicate: "That username is already in use.",
  match: "New passwords do not match.",
  missing: "All password fields are required.",
  short: "New password must be at least 12 characters.",
  userMissing: "User could not be found.",
  username: "Username must be 3-32 characters using lowercase letters, numbers, underscores, or hyphens.",
  userPasswordMissing: "Initial password is required.",
  userPasswordShort: "Initial password must be at least 12 characters.",
};

const statusMessages: Record<string, string> = {
  "admin-transferred": "Admin role transferred.",
  "admin-unchanged": "That user is already the admin.",
  "user-created": "User created.",
  "username-updated": "Username updated.",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const users = user.role === "ADMIN"
    ? await prisma.user.findMany({ orderBy: [{ role: "desc" }, { username: "asc" }] })
    : [];

  const { error, message: status } = await searchParams;
  const message = error ? errorMessages[error] : null;
  const statusMessage = status ? statusMessages[status] : null;

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
            Manage your account and password.
          </p>
        </header>

        {statusMessage ? (
          <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">
            {statusMessage}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Account</h2>
          <p className="mt-2 text-sm font-semibold text-zinc-400">
            Signed in as {user.username}. Role: {user.role.toLowerCase()}.
          </p>

          <form action={updateOwnUsernameAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-200">Username</span>
              <input
                className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                defaultValue={user.username}
                required
              />
            </label>

            <button className="h-14 w-full rounded-2xl bg-zinc-50 px-5 text-base font-black text-zinc-950 transition hover:bg-white">
              Save username
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Password</h2>

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
                minLength={minimumPasswordLength}
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
                minLength={minimumPasswordLength}
                required
              />
            </label>

            <button className="h-14 w-full rounded-2xl bg-lime-300 px-5 text-base font-black text-zinc-950 transition hover:bg-lime-200">
              Change password
            </button>
          </form>
        </section>

        {user.role === "ADMIN" ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xl font-black">Users</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-400">
              Create users, rename accounts, and transfer the single admin role.
            </p>

            <form action={createUserAction} className="mt-5 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="font-black">Create user</h3>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">Username</span>
                <input
                  className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                  name="username"
                  type="text"
                  autoCapitalize="none"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">Initial password</span>
                <input
                  className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={minimumPasswordLength}
                  required
                />
              </label>
              <button className="h-14 w-full rounded-2xl bg-lime-300 px-5 text-base font-black text-zinc-950 transition hover:bg-lime-200">
                Create user
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {users.map((listedUser) => (
                <div key={listedUser.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{listedUser.username}</p>
                      <p className="text-sm font-semibold text-zinc-500">{listedUser.role.toLowerCase()}</p>
                    </div>
                    {listedUser.role === "ADMIN" ? (
                      <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-zinc-950">Admin</span>
                    ) : null}
                  </div>

                  <form action={updateUserUsernameAction.bind(null, listedUser.id)} className="flex gap-2">
                    <input
                      className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
                      name="username"
                      type="text"
                      autoCapitalize="none"
                      defaultValue={listedUser.username}
                      required
                    />
                    <button className="h-12 rounded-2xl bg-zinc-50 px-4 text-sm font-black text-zinc-950">
                      Rename
                    </button>
                  </form>

                  {listedUser.role !== "ADMIN" ? (
                    <form action={transferAdminAction.bind(null, listedUser.id)} className="mt-3">
                      <button className="h-12 w-full rounded-2xl border border-amber-300/40 px-4 text-sm font-black text-amber-100">
                        Transfer admin to {listedUser.username}
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
