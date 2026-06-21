import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const databaseUrl = process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error("POSTGRES_PRISMA_URL is required to seed the initial user.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (existingAdmin) {
    console.log("Admin user already exists; seed skipped.");
    return;
  }

  const existingUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "ADMIN" },
    });
    console.log(`Promoted initial admin user: ${existingUser.username}`);
    return;
  }

  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username: "admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Workout Tracker initial password: ${password}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
