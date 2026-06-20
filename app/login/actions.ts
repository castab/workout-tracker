"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, deleteCurrentSession, ensureInitialAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidUsername, normalizeUsername } from "@/lib/users";

export async function loginAction(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  await ensureInitialAdminUser();

  if (!isValidUsername(username)) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    redirect("/login?error=invalid");
  }

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
