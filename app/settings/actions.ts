"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { deleteCurrentSession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const minimumPasswordLength = 12;

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
