import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join, sep, basename } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
function rewrite(dir, ending) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) rewrite(file, ending);
    else if (/\.(ts|mjs|json|sql|prisma|md)$/.test(entry.name)) {
      writeFileSync(
        file,
        readFileSync(file, "utf8")
          .replace(/\r\n?/g, "\n")
          .replaceAll("\n", ending),
      );
    }
  }
}
test("backend inventory is portable across source/output line endings and still rejects stale references", () => {
  const temporary = mkdtempSync(join(root, ".backend-inventory-test-"));
  try {
    const results = [];
    for (const [name, ending] of [
      ["lf", "\n"],
      ["crlf", "\r\n"],
    ]) {
      const fixture = join(temporary, name),
        backend = join(fixture, "apps/backend");
      mkdirSync(join(backend, "scripts/prisma"), { recursive: true });
      cpSync(join(root, "apps/backend/server"), join(backend, "server"), {
        recursive: true,
        filter: (file) => basename(file) !== "generated",
      });
      cpSync(join(root, "apps/backend/prisma"), join(backend, "prisma"), {
        recursive: true,
      });
      for (const file of [
        "backend-inventory.mjs",
        "backend-inventory.json",
        "backend-schema-snapshot.mjs",
        "institution-names.json",
        "prisma/docker.mjs",
      ])
        cpSync(
          join(root, "apps/backend/scripts", file),
          join(backend, "scripts", file),
        );
      const receipt = join(fixture, "docs/verification/receipts");
      mkdirSync(receipt, { recursive: true });
      cpSync(
        join(root, "docs/verification/receipts/backend-schema-catalog.json"),
        join(receipt, "backend-schema-catalog.json"),
      );
      rewrite(backend, ending);
      const generator = join(backend, "scripts/backend-inventory.mjs");
      execFileSync(process.execPath, [generator], {
        cwd: fixture,
        stdio: "pipe",
      });
      const docs = join(fixture, "docs/reference/backend");
      results.push(
        ["schema.md", "routes.md"].map((file) =>
          readFileSync(join(docs, file), "utf8"),
        ),
      );
      rewrite(docs, ending);
      execFileSync(process.execPath, [generator, "--check"], {
        cwd: fixture,
        stdio: "pipe",
      });
      const routeFile = join(docs, "routes.md");
      writeFileSync(
        routeFile,
        readFileSync(routeFile, "utf8") + "\nStale reference.\n",
      );
      assert.throws(() =>
        execFileSync(process.execPath, [generator, "--check"], {
          cwd: fixture,
          stdio: "pipe",
        }),
      );
    }
    assert.deepEqual(results[0], results[1]);
  } finally {
    assert.ok(resolve(temporary).startsWith(resolve(root) + sep));
    assert.ok(basename(temporary).startsWith(".backend-inventory-test-"));
    rmSync(temporary, { recursive: true, force: true });
  }
});
