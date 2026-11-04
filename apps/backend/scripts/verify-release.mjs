import { execFileSync, spawn } from "node:child_process";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
  createWriteStream,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalRelease } from "./release-guard.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  repo = resolve(root, "../.."),
  web = resolve(repo, "apps/frontend"),
  composeFile = resolve(repo, "infrastructure/compose.yaml");
const full = process.argv.includes("--full");
if (process.argv.slice(2).some((x) => !["--full", "--check"].includes(x)))
  throw Error("Use --check (prerequisites only) or --full (all local gates).");
const output = resolve(
  root,
  "artifacts/release",
  new Date().toISOString().replaceAll(":", "-"),
);
mkdirSync(output, { recursive: true });
const report = {
  scope: "local only",
  mode: full ? "full" : "prerequisites",
  startedAt: new Date().toISOString(),
  status: "running",
  unverified: [
    "hosted operations",
    "remote CI",
    "physical devices and assistive technology",
    "human usability and retention",
    "external delivery and payments",
  ],
  steps: [],
};
const save = () =>
  writeFileSync(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
const lock = resolve(root, "artifacts/release/running.lock");
let locked = false;
async function step(name, cwd, args) {
  const index = report.steps.length + 1,
    log = `${index}-${name}.log`,
    start = Date.now();
  const row = { name, log, status: "running", durationMs: 0 };
  report.steps.push(row);
  save();
  console.log(`Running ${name}`);
  const stream = createWriteStream(resolve(output, log));
  const child = spawn(args[0], args.slice(1), {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  const code = await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("close", accept);
  }).finally(() => stream.end());
  row.durationMs = Date.now() - start;
  row.status = code === 0 ? "passed" : "failed";
  save();
  if (code !== 0) throw Error(`${name} failed; inspect ${log}`);
}
try {
  closeSync(openSync(lock, "wx"));
  locked = true;
  if (!existsSync(resolve(repo, "node_modules")))
    throw Error("Install pinned monorepo dependencies first.");
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  assertLocalRelease({
    nodeVersion: process.version,
    config: readFileSync(composeFile, "utf8"),
    linked: false,
    branch,
    webEnvironment: readFileSync(resolve(web, ".env.local"), "utf8"),
  });
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "db",
      "pg_isready",
      "-U",
      "rafik_migrate",
      "-d",
      "rafik",
    ],
    { stdio: "pipe" },
  );
  for (const port of [55331, 5173, 5174]) {
    const response = await fetch(
      `http://127.0.0.1:${port}${port === 55331 ? "/health" : ""}`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw Error(`Start the local web server on ${port}.`);
  }
  report.steps.push({ name: "prerequisites", status: "passed" });
  save();
  if (full) {
    for (const script of [
      "test:release",
      "test:retired-domains",
      "test",
      "test:organizations",
      "test:programming",
      "test:organization-services",
      "test:organization-nutrition",
      "test:communication",
      "test:organization-assets",
      "test:organization-feedback",
      "test:operations",
      "content:check",
      "content:media",
      "content:videos",
      "content:exercise-dataset:check",
      "content:wger-exercises:check",
      "test:catalog",
      "test:docs",
    ])
      await step("backend-" + script.replaceAll(":", "-"), root, [
        "npm",
        "run",
        script,
      ]);
    await step("api-types", root, ["npm", "run", "typecheck"]);
    await step("api-contract", root, ["npm", "run", "test:api"]);
    for (const script of [
      "test",
      "format:check",
      "build",
      "test:build",
      "test:e2e",
      "test:operations:layout",
      "test:cohesion:layout",
    ])
      await step("web-" + script.replaceAll(":", "-"), web, [
        "npm",
        "run",
        script,
      ]);
  }
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.message;
  process.exitCode = 1;
  console.error(e.message);
} finally {
  report.finishedAt = new Date().toISOString();
  save();
  if (locked) unlinkSync(lock);
  console.log(`Local report: ${output}/report.json`);
}
