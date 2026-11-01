import { ApiError } from "./db.ts";

/*
 * Institution-local calendar days. Training dates, plan date ranges and readiness are
 * compared on the wall-clock day of the relevant zone (event, rule or profile), never the
 * server's UTC day: an evening session in UTC+3 must not count as tomorrow's work.
 */

/** YYYY-MM-DD in `timezone` at `at`. An unknown zone throws RangeError (stored zones are trusted). */
export function localDateText(timezone: string, at: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** As localDateText, for client-supplied zones: an unknown zone is a 400, not a server error. */
export function checkedLocalDateText(timezone: string, at: Date) {
  try {
    return localDateText(timezone, at);
  } catch {
    throw new ApiError(400, "invalid_timezone");
  }
}

/** The local day as a UTC-midnight Date, matching how Prisma returns PostgreSQL date columns. */
export const localDay = (timezone: string, at: Date) =>
  new Date(localDateText(timezone, at) + "T00:00:00Z");
