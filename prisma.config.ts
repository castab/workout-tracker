import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.APP_MODE === "demo";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: demoMode
      ? "postgresql://demo:demo@localhost:5432/demo?schema=public"
      : env("DATABASE_DIRECT_URL"),
  },
});
