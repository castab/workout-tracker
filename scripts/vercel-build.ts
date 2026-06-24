import { spawn } from "node:child_process";

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.APP_MODE === "demo";

function run(command: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code ?? 1}`));
      }
    });
  });
}

await run("prisma generate");

if (demoMode) {
  console.info("Skipping Prisma migrations in demo mode.");
} else {
  await run("prisma migrate deploy");
}

await run("next build");
