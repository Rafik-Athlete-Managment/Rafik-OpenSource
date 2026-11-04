import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { ApiError } from "./db.ts";
const testDirectory = process.env.RAFIK_TEST_FILES;
if (testDirectory && !/^\.local\/browser-[0-9]+$/.test(testDirectory))
  throw Error("Invalid isolated file directory");
const directory = resolve(testDirectory || ".local/files");
const location = (path: string) =>
  resolve(directory, createHash("sha256").update(path).digest("hex"));
/** Reads private file bytes through the configured storage adapter. */
export async function readPrivate(path: string) {
  return readFile(location(path)).catch((e) => {
    if (e.code === "ENOENT") throw new ApiError(404, "resource_unavailable");
    throw e;
  });
}
/** Stores private file bytes and returns the durable reference used by the database. */
export async function writePrivate(path: string, bytes: Buffer) {
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(location(path), bytes, { flag: "wx", mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const old = await readFile(location(path));
    if (!old.equals(bytes)) throw new ApiError(409, "file_mismatch");
  }
}
/** Removes private file bytes after the owning record no longer needs them. */
export async function removePrivate(path: string) {
  await unlink(location(path)).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
}
