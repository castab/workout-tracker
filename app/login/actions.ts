"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const user = await prisma.user.findUnique({ where: { email } });

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
