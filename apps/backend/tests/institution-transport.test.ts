import { test, after } from "node:test";
import assert from "node:assert/strict";
import { institutionTransport } from "../server/institution-routing.ts";
import { db } from "../server/db.ts";
after(() => db.$disconnect());
test("institution transport preserves scalar serializers and opaque durable documents", () => {
  class Numeric {
    toJSON() {
      return "12.345";
    }
  }
  const source = {
    workspace_id: "retained-id",
    amount: new Numeric(),
    at: new Date("2026-10-23T12:00:00Z"),
    document: { workspace_id: "frozen-id" },
  };
  const result = JSON.parse(JSON.stringify(institutionTransport(source)));
  assert.deepEqual(result, {
    institution_id: "retained-id",
    amount: "12.345",
    at: "2026-10-23T12:00:00.000Z",
    document: { workspace_id: "frozen-id" },
  });
});
