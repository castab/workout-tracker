import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the initial user.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (existingUser) {
    console.log("Auth user already exists; seed skipped.");
    return;
  }

  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      id: "auth-user",
      passwordHash,
    },
  });

  console.log(`Workout Tracker initial password: ${password}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
