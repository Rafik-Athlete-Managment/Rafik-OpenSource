import assert from "node:assert/strict";
import { test } from "node:test";
import { startInjuryRetention } from "../server/injury-retention.ts";

test("retention retries after a failure and returns to daily cadence after success", async () => {
  const delays: number[] = [];
  const callbacks: (() => void)[] = [];
  let attempts = 0;
  let failures = 0;
  const schedule = (callback: () => void, delay: number) => {
    callbacks.push(callback);
    delays.push(delay);
    return { unref() {} } as ReturnType<typeof setTimeout>;
  };

  startInjuryRetention(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("database unavailable");
      return { closed: 0, expired: 0 };
    },
    schedule,
    () => (failures += 1),
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(delays, [15 * 60 * 1000]);
  assert.equal(failures, 1);

  callbacks.shift()?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(delays, [15 * 60 * 1000, 24 * 60 * 60 * 1000]);
  assert.equal(attempts, 2);
  assert.equal(failures, 1);
});
