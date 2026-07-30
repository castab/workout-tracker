import { redirect } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
          <Alert variant="success" className="mb-5">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <form action={loginAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-username" className="text-sm font-semibold text-zinc-200">
                Username
              </FieldLabel>
              <Input
                id="login-username"
                className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                defaultValue="admin"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="login-password" className="text-sm font-semibold text-zinc-200">
                Password
              </FieldLabel>
              <Input
                id="login-password"
                className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <p className="text-xs leading-5 text-zinc-500">
              On first setup, sign in as admin. The initial password is printed once in the server logs.
            </p>

            <Button className="h-14 w-full rounded-2xl text-base font-black">
              Sign in
            </Button>
          </FieldGroup>
        </form>
      </section>
    </main>
  );
}
