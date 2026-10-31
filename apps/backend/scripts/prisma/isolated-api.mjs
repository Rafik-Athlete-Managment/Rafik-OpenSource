import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync, rmSync } from "node:fs";
import { backendRoot, repositoryRoot, dockerCompose } from "./docker.mjs";

const database = "rafik_browser_" + Date.now(),
  port = 55343;
const api = `http://127.0.0.1:${port}`;
const sql = (name, input) =>
  dockerCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "rafik_migrate",
      "-d",
      name,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input, stdio: "pipe" },
  );
const env = {
  ...process.env,
  PORT: String(port),
  RAFIK_TEST_API: api,
  RAFIK_DISABLE_WORKOUT_SCHEDULER: "true",
  DATABASE_URL: `postgresql://rafik_api:rafik-local-api-only@127.0.0.1:55332/${database}`,
  RAFIK_TEST_FILES: ".local/browser-" + database.slice("rafik_browser_".length),
  MIGRATION_DATABASE_URL: `postgresql://rafik_migrate:rafik-local-migrations-only@127.0.0.1:55332/${database}`,
};
let created = false,
  server,
  logs = "";
try {
  let occupied = false;
  try {
    await fetch(api + "/health", { signal: AbortSignal.timeout(300) });
    occupied = true;
  } catch {}
  if (occupied) throw Error("Isolated API port is already occupied");
  sql("rafik", `CREATE DATABASE ${database};`);
  created = true;
  execFileSync(
    process.execPath,
    [
      resolve(repositoryRoot, "node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
    ],
    { cwd: backendRoot, env, stdio: "pipe" },
  );
  const tsx = resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs");
  // Preserve the canonical reference fixture expected by existing domain suites.
  sql(
    database,
    readFileSync(resolve(backendRoot, "prisma/seed.sql"), "utf8") +
      "\nDELETE FROM public.institutions WHERE id='12000000-0000-4000-8000-000000000002';",
  );
  server = spawn(process.execPath, [tsx, "server/index.ts"], {
    cwd: backendRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (b) => {
      logs = (logs + b).slice(-5000);
    });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Isolated API exited: " + logs);
    try {
      if ((await fetch(api + "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw Error("Isolated API did not start: " + logs);
  const files = process.argv.slice(2);
  if (
    !files.length ||
    files.some((f) => !/^tests\/[a-z0-9-]+\.test\.ts$/.test(f))
  )
    throw Error("Pass explicit backend test files");
  try {
    execFileSync(
      process.execPath,
      [tsx, "--test", "--test-concurrency=1", ...files],
      { cwd: backendRoot, env, stdio: "inherit" },
    );
  } catch (error) {
    console.error(logs);
    throw error;
  }
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => {
      server.once("exit", r);
      setTimeout(r, 2000);
    });
  }
  if (created) sql("rafik", `DROP DATABASE ${database} WITH (FORCE);`);
  const files = resolve(backendRoot, env.RAFIK_TEST_FILES);
  if (
    files !==
    resolve(
      backendRoot,
      ".local",
      "browser-" + database.slice("rafik_browser_".length),
    )
  )
    throw Error("Unexpected fixture directory");
  rmSync(files, { recursive: true, force: true });
}
