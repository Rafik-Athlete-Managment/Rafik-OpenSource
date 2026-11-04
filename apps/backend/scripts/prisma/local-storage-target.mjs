import { resolve } from "node:path";
import { backendRoot } from "./docker.mjs";

// Recovery and orphan cleanup must inspect the same database/bytes as the API.
export function localStorageTarget(env = process.env) {
  const url = new URL(
    env.DATABASE_URL || "postgresql://rafik_api@127.0.0.1:55332/rafik",
  );
  const database = url.pathname.slice(1);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55332" ||
    url.username !== "rafik_api" ||
    !/^(rafik|rafik_browser_\d+)$/.test(database)
  )
    throw Error("Local storage operations require a validated local database");
  const testDirectory = env.RAFIK_TEST_FILES;
  if (database !== "rafik") {
    const expected =
      ".local/browser-" + database.slice("rafik_browser_".length);
    if (testDirectory !== expected)
      throw Error("Isolated database and private-file directory must match");
  } else if (testDirectory)
    throw Error(
      "Preview database cannot use an isolated private-file directory",
    );
  const files = resolve(backendRoot, testDirectory || ".local/files");
  return {
    database,
    files,
    backups:
      database === "rafik"
        ? resolve(backendRoot, ".local/backups")
        : resolve(files, "recovery"),
  };
}
