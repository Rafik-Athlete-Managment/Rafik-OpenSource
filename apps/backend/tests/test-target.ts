export const apiOrigin = process.env.RAFIK_TEST_API || "";
export const testDatabase = new URL(
  process.env.DATABASE_URL || "postgresql://localhost/invalid",
).pathname.slice(1);
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(apiOrigin) ||
  !/^rafik_browser_\d+$/.test(testDatabase)
)
  throw Error(
    "Backend integration tests require scripts/prisma/isolated-api.mjs",
  );
