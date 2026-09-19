import { test } from "node:test";
import assert from "node:assert/strict";
import { commandSchema } from "../lib/validation";
import { localDay } from "../lib/types";
const id = "d4d791cb-7ffd-4016-b68e-15b6e413447d";
test("rejects invalid statuses, dates, and blank updates", () => {
  assert.equal(
    commandSchema.safeParse({ action: "status", id, status: "Unknown" })
      .success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      action: "day",
      id,
      day: "2026-02-31",
      included: true,
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ action: "update", id, message: "   " }).success,
    false,
  );
});
test("supports explicit unassignment and dropped tasks", () => {
  assert.equal(
    commandSchema.safeParse({
      action: "assign",
      id,
      member_id: null,
      team_id: null,
    }).success,
    true,
  );
  assert.equal(
    commandSchema.safeParse({ action: "status", id, status: "Dropped" })
      .success,
    true,
  );
});
test("planning dates use the local calendar date", () => {
  assert.equal(localDay(new Date(2026, 8, 18, 23, 59)), "2026-09-18");
});
