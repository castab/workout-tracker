import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_POOL_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_POOL_URL is required to start the local Postgres container.",
  );
}

const url = new URL(databaseUrl);

if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
  throw new Error(
    "DATABASE_POOL_URL must use the postgresql:// or postgres:// protocol.",
  );
}

const postgresDb = decodeURIComponent(url.pathname.replace(/^\//, ""));
const postgresUser = decodeURIComponent(url.username);
const postgresPassword = decodeURIComponent(url.password);

if (!postgresDb || !postgresUser || !postgresPassword) {
  throw new Error(
    "DATABASE_POOL_URL must include a database name, username, and password.",
  );
}

const result = spawnSync("docker", ["compose", "up", "-d", "postgres"], {
  env: {
    ...process.env,
    POSTGRES_DB: postgresDb,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
