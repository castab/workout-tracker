"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteCurrentSession, requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidUsername, minimumPasswordLength, normalizeUsername } from "@/lib/users";

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/settings?error=missing");
  }

  const currentPasswordIsValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!currentPasswordIsValid) {
    redirect("/settings?error=current");
  }

  if (newPassword.length < minimumPasswordLength) {
    redirect("/settings?error=short");
  }

  if (newPassword !== confirmPassword) {
    redirect("/settings?error=match");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await deleteCurrentSession();

  redirect("/login?message=password-updated");
}

function usernameFromFormData(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));

  if (!username || !isValidUsername(username)) {
    redirect("/settings?error=username");
  }

  return username;
}

async function usernameExistsForAnotherUser(username: string, userId: string) {
  const existingUser = await prisma.user.findUnique({ where: { username } });

  return Boolean(existingUser && existingUser.id !== userId);
}

export async function updateOwnUsernameAction(formData: FormData) {
  const user = await requireUser();
  const username = usernameFromFormData(formData);

  if (await usernameExistsForAnotherUser(username, user.id)) {
    redirect("/settings?error=duplicate");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { username },
  });

  revalidatePath("/settings");
  redirect("/settings?message=username-updated");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const username = usernameFromFormData(formData);
  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect("/settings?error=userPasswordMissing");
  }

  if (password.length < minimumPasswordLength) {
    redirect("/settings?error=userPasswordShort");
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    redirect("/settings?error=duplicate");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "USER",
    },
  });

  revalidatePath("/settings");
  redirect("/settings?message=user-created");
}

export async function updateUserUsernameAction(userId: string, formData: FormData) {
  await requireAdmin();

  const username = usernameFromFormData(formData);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    redirect("/settings?error=userMissing");
  }

  if (await usernameExistsForAnotherUser(username, userId)) {
    redirect("/settings?error=duplicate");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { username },
  });

  revalidatePath("/settings");
  redirect("/settings?message=username-updated");
}

export async function transferAdminAction(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    redirect("/settings?message=admin-unchanged");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!targetUser) {
    redirect("/settings?error=userMissing");
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { role: "ADMIN" },
      data: { role: "USER" },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    }),
  ]);

  revalidatePath("/settings");
  redirect("/settings?message=admin-transferred");
}
