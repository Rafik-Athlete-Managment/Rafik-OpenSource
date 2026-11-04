import { test } from "node:test";
import assert from "node:assert/strict";
import { localStorageTarget } from "./local-storage-target.mjs";

test("ordinary local storage retains preview defaults", () => {
  const target = localStorageTarget({});
  assert.equal(target.database, "rafik");
  assert.match(target.files.replaceAll("\\", "/"), /\/\.local\/files$/);
});
test("isolated database, files and recovery output share the same scope", () => {
  const target = localStorageTarget({
    DATABASE_URL: "postgresql://rafik_api@127.0.0.1:55332/rafik_browser_123",
    RAFIK_TEST_FILES: ".local/browser-123",
  });
  assert.equal(target.database, "rafik_browser_123");
  assert.equal(
    target.backups,
    target.files + (process.platform === "win32" ? "\\" : "/") + "recovery",
  );
});
test("mixed scopes and nonlocal databases are refused before filesystem access", () => {
  for (const env of [
    {
      DATABASE_URL: "postgresql://rafik_api@127.0.0.1:55332/rafik_browser_123",
    },
    {
      DATABASE_URL: "postgresql://rafik_api@127.0.0.1:55332/rafik_browser_123",
      RAFIK_TEST_FILES: ".local/browser-456",
    },
    { RAFIK_TEST_FILES: ".local/browser-123" },
    { DATABASE_URL: "postgresql://rafik_api@example.test:55332/rafik" },
  ])
    assert.throws(() => localStorageTarget(env));
});
