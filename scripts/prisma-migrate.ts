import { spawn } from "node:child_process";

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.APP_MODE === "demo";

if (demoMode) {
  console.info("Skipping Prisma migrations in demo mode.");
  process.exit(0);
}

const child = spawn("prisma", ["migrate", "dev"], {
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
