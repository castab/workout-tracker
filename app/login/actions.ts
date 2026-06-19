"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, deleteCurrentSession, ensureAuthUser } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect("/login?error=missing");
  }

  const user = await ensureAuthUser();

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/login");
}
