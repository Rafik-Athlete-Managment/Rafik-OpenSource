import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ApiError } from "./db.ts";

// Public reference content only. No person, organization or uploaded content belongs here.
const root = new URL("../content/", import.meta.url);
/** Returns the shared food entries used by meal plans and food logging. */
export async function foodCatalog() {
  return JSON.parse(await readFile(new URL("foods.json", root), "utf8"));
}
// Shared catalogue source and licence data is public reference content for web
// and mobile clients. It deliberately contains no upstream exercise media.
/** Returns the curated exercise dataset used by the program editor. */
export async function exerciseDatasetCatalog() {
  return JSON.parse(
    await readFile(new URL("exercise-dataset.json", root), "utf8"),
  );
}
/** Searches the external exercise reference catalog through the server. */
export async function wgerExerciseCatalog() {
  return JSON.parse(
    await readFile(
      new URL("upstream/wger/exercise-snapshot.json", root),
      "utf8",
    ),
  );
}
/** Lists credited exercise illustrations available to the exercise picker. */
export async function exerciseMediaCatalog() {
  return JSON.parse(
    await readFile(new URL("exercise-media.json", root), "utf8"),
  );
}
/** Delivers one public exercise illustration identified by the media catalog. */
export async function exerciseMediaAsset(key: string, frame: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(key) || !/^[123]$/.test(frame))
    throw new ApiError(404, "resource_unavailable");
  const manifest = await exerciseMediaCatalog();
  const item = manifest.items.find((item: { id: string }) => item.id === key);
  const asset = item?.frames[Number(frame) - 1];
  if (!asset) throw new ApiError(404, "resource_unavailable");
  const bytes = await readFile(
    new URL(`exercise-media/${key}/${frame}.svg`, root),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new ApiError(503, "resource_unavailable");
  return { bytes, digest: asset.sha256 };
}

/** Lists reviewed exercise videos and their attribution details. */
export async function exerciseVideoCatalog() {
  return JSON.parse(
    await readFile(new URL("exercise-videos.json", root), "utf8"),
  );
}
/** Delivers one exercise video after resolving its catalog identifier. */
export async function exerciseVideoAsset(key: string, extension: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(key) || !["mp4", "webp"].includes(extension))
    throw new ApiError(404, "resource_unavailable");
  const manifest = await exerciseVideoCatalog();
  const item = manifest.items.find((item: { id: string }) => item.id === key);
  const asset = extension === "mp4" ? item?.video : item?.poster;
  if (!asset) throw new ApiError(404, "resource_unavailable");
  const bytes = await readFile(
    new URL(`exercise-videos/${key}.${extension}`, root),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new ApiError(503, "resource_unavailable");
  return { bytes, digest: asset.sha256, mime: asset.mime };
}
// Single byte ranges support Safari playback/seeking. Multiple or invalid ranges are rejected.
/** Selects the requested byte range when a video player resumes a download. */
export function videoRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]))
    throw new ApiError(416, "invalid_range");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    start < 0 ||
    end < start
  )
    throw new ApiError(416, "invalid_range");
  return { start, end };
}
