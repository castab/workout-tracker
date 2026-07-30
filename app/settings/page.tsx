import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/app/demo-mode";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  if (isDemoMode()) {
    redirect("/");
  }

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
        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20 ring-0">
          <CardContent className="p-0">
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
          </CardContent>
        </Card>

        {statusMessage ? (
          <Alert variant="success">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
          <CardHeader className="p-0">
            <h2 className="text-xl font-black">Account</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-400">
              Signed in as {user.username}. Role: {user.role.toLowerCase()}.
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <form action={updateOwnUsernameAction} className="mt-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account-username" className="text-sm font-semibold text-zinc-200">
                    Username
                  </FieldLabel>
                  <Input
                    id="account-username"
                    className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                    name="username"
                    type="text"
                    autoCapitalize="none"
                    autoComplete="username"
                    defaultValue={user.username}
                    required
                  />
                </Field>

                <Button variant="secondary" className="h-14 w-full rounded-2xl text-base font-black">
                  Save username
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
          <CardHeader className="p-0">
            <h2 className="text-xl font-black">Password</h2>
          </CardHeader>

          <CardContent className="p-0">
            <form action={changePasswordAction} className="mt-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-password" className="text-sm font-semibold text-zinc-200">
                    Current password
                  </FieldLabel>
                  <Input
                    id="current-password"
                    className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="new-password" className="text-sm font-semibold text-zinc-200">
                    New password
                  </FieldLabel>
                  <Input
                    id="new-password"
                    className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirm-password" className="text-sm font-semibold text-zinc-200">
                    Confirm new password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    className="h-14 rounded-2xl bg-zinc-950 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                  />
                </Field>

                <Button className="h-14 w-full rounded-2xl text-base font-black">
                  Change password
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        {user.role === "ADMIN" ? (
          <Card className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ring-0">
            <CardHeader className="p-0">
              <h2 className="text-xl font-black">Users</h2>
              <p className="mt-2 text-sm font-semibold text-zinc-400">
                Create users, rename accounts, and transfer the single admin role.
              </p>
            </CardHeader>

            <CardContent className="p-0">
              <form action={createUserAction} className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <FieldGroup>
                  <h3 className="font-black">Create user</h3>
                  <Field>
                    <FieldLabel htmlFor="new-user-username" className="text-sm font-semibold text-zinc-200">
                      Username
                    </FieldLabel>
                    <Input
                      id="new-user-username"
                      className="h-14 rounded-2xl bg-zinc-900 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                      name="username"
                      type="text"
                      autoCapitalize="none"
                      autoComplete="off"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-user-password" className="text-sm font-semibold text-zinc-200">
                      Initial password
                    </FieldLabel>
                    <Input
                      id="new-user-password"
                      className="h-14 rounded-2xl bg-zinc-900 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={minimumPasswordLength}
                      required
                    />
                  </Field>
                  <Button className="h-14 w-full rounded-2xl text-base font-black">
                    Create user
                  </Button>
                </FieldGroup>
              </form>

              <div className="mt-5 space-y-3">
                {users.map((listedUser) => (
                <Card key={listedUser.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 ring-0">
                  <CardContent className="p-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{listedUser.username}</p>
                        <p className="text-sm font-semibold text-zinc-500">{listedUser.role.toLowerCase()}</p>
                      </div>
                      {listedUser.role === "ADMIN" ? (
                        <Badge className="text-xs font-black">Admin</Badge>
                      ) : null}
                    </div>

                    <form action={updateUserUsernameAction.bind(null, listedUser.id)} className="flex gap-2">
                      <Input
                        className="h-12 min-w-0 flex-1 rounded-2xl bg-zinc-900 px-4 text-base focus-visible:border-lime-300 focus-visible:ring-lime-300/20"
                        name="username"
                        type="text"
                        autoCapitalize="none"
                        defaultValue={listedUser.username}
                        aria-label={`Rename ${listedUser.username}`}
                        required
                      />
                      <Button variant="secondary" className="h-12 rounded-2xl px-4 text-sm font-black">
                        Rename
                      </Button>
                    </form>

                    {listedUser.role !== "ADMIN" ? (
                      <form action={transferAdminAction.bind(null, listedUser.id)} className="mt-3">
                        <Button
                          variant="outline"
                          className="h-12 w-full rounded-2xl border-amber-300/40 px-4 text-sm font-black text-amber-100 hover:bg-amber-300/10 hover:text-amber-100"
                        >
                          Transfer admin to {listedUser.username}
                        </Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
