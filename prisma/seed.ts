import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const email = process.env.INITIAL_USER_EMAIL;
const password = process.env.INITIAL_USER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!email) {
  throw new Error("INITIAL_USER_EMAIL is required to seed the initial user.");
}

if (!password) {
  throw new Error("INITIAL_USER_PASSWORD is required to seed the initial user.");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the initial user.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);

  await prisma.user.upsert({
    where: { email: email! },
    update: { passwordHash },
    create: { email: email!, passwordHash },
  });

  console.log(`Seeded initial user: ${email}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
