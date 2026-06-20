import "server-only";

import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "workout_tracker_session";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureInitialAdminUser() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (existingAdmin) {
    return existingAdmin;
  }

  const existingUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "ADMIN" },
    });
  }

  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        username: "admin",
        role: "ADMIN",
        passwordHash,
      },
    });

    console.info(`Workout Tracker initial password: ${password}`);

    return user;
  } catch (error) {
    const user = await prisma.user.findFirst({ where: { role: "ADMIN" } });

    if (user) {
      return user;
    }

    throw error;
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/settings?error=admin");
  }

  return user;
}
