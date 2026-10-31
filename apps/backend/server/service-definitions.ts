import { ApiError } from "./db.ts";
import { textValue, uuid } from "./institution.ts";
export type Drill = {
  key: string;
  name: string;
  unit: string;
  kind: "number" | "text";
  min?: number;
  max?: number;
};
export function definition(value: unknown): Drill[] {
  if (!Array.isArray(value) || !value.length || value.length > 12)
    throw new ApiError(400, "invalid_assessment");
  const items = value.map((d: Record<string, unknown>) => {
    if (
      !d ||
      typeof d !== "object" ||
      !["number", "text"].includes(String(d.kind))
    )
      throw new ApiError(400, "invalid_assessment");
    const item: Drill = {
      key: uuid(d.key),
      name: textValue(d.name, 100),
      unit: typeof d.unit === "string" ? d.unit.trim() : "",
      kind: d.kind as Drill["kind"],
    };
    if (item.unit.length > 30) throw new ApiError(400, "invalid_assessment");
    for (const bound of ["min", "max"] as const)
      if (d[bound] !== null && d[bound] !== undefined && d[bound] !== "") {
        if (
          typeof d[bound] !== "number" ||
          !Number.isFinite(d[bound]) ||
          Math.abs(d[bound] as number) > 1e9
        )
          throw new ApiError(400, "invalid_assessment");
        item[bound] = d[bound] as number;
      }
    if (item.min !== undefined && item.max !== undefined && item.min > item.max)
      throw new ApiError(400, "invalid_assessment");
    return item;
  });
  if (new Set(items.map((d) => d.key)).size !== items.length)
    throw new ApiError(400, "invalid_assessment");
  return items;
}
export function assessmentValues(drills: Drill[], value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "invalid_results");
  const values = value as Record<string, unknown>;
  if (Object.keys(values).some((k) => !drills.some((d) => d.key === k)))
    throw new ApiError(400, "invalid_results");
  return Object.fromEntries(
    drills.map((d) => {
      const v = values[d.key];
      if (d.kind === "text") return [d.key, textValue(v, 1000)];
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        Math.abs(v) > 1e9 ||
        (d.min !== undefined && v < d.min) ||
        (d.max !== undefined && v > d.max)
      )
        throw new ApiError(400, "invalid_results");
      return [d.key, v];
    }),
  );
}
export function ids(value: unknown, max: number, min = 1): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new ApiError(400, "invalid_recipients");
  const list = value.map(uuid);
  if (new Set(list).size !== list.length)
    throw new ApiError(400, "invalid_recipients");
  return list;
}
export function calendarDate(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, "invalid_date");
  return value;
}

export function pageOffset(value: string | null) {
  if (value === null) return 0;
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 100000
  )
    throw new ApiError(400, "invalid_request");
  return Number(value);
}
