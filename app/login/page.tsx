import { redirect } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { ensureInitialAdminUser, getCurrentUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Username or password is incorrect.",
  missing: "Username and password are required.",
};

const statusMessages: Record<string, string> = {
  "password-updated": "Password updated. Sign in with the new password.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (isDemoMode()) {
    redirect("/");
  }

  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  await ensureInitialAdminUser();

  const { error, message: status } = await searchParams;
  const message = error ? errorMessages[error] : null;
  const statusMessage = status ? statusMessages[status] : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-6 text-zinc-50 sm:py-10">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/30">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-lime-300">
            Workout Tracker
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Private access for your gym notebook replacement.
          </p>
        </div>

        {statusMessage ? (
          <div className="mb-5 rounded-2xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">
            {statusMessage}
          </div>
        ) : null}

        {message ? (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-zinc-200">Username</span>
            <input
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
              name="username"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              defaultValue="admin"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-zinc-200">Password</span>
            <input
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <p className="text-xs leading-5 text-zinc-500">
            On first setup, sign in as admin. The initial password is printed once in the server logs.
          </p>

          <button className="h-14 w-full rounded-2xl bg-lime-300 px-5 text-base font-black text-zinc-950 transition hover:bg-lime-200">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
