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

test("target dates support setting, clearing and omission without accepting invalid dates", () => {
  const update = { action: "update", id, message: "Revised estimate" };
  for (const target_date of ["2028-02-29", "2026-09-22", null]) {
    assert.equal(commandSchema.safeParse({ ...update, target_date }).success, true);
  }
  for (const target_date of ["2026-02-29", "2026-09-31", "tomorrow", "2026-09-22T00:00:00Z", ""]) {
    assert.equal(commandSchema.safeParse({ ...update, target_date }).success, false);
  }
  const unchanged = commandSchema.parse(update);
  assert.equal("target_date" in unchanged, false);
  const created = commandSchema.parse({ action: "task", project_id: id, title: "Task" });
  assert.equal("target_date" in created && created.target_date, null);
});

test("task creation accepts an optional assignee and due date", () => {
  const task = { action: "task", project_id: id, title: "New task" };
  for (const member_id of [undefined, null, id]) {
    const result = commandSchema.parse({ ...task, member_id, target_date: "2026-10-01" });
    assert.equal(result.action, "task");
    if (result.action === "task") {
      assert.equal(result.member_id, member_id ?? null);
      assert.equal(result.target_date, "2026-10-01");
    }
  }
  assert.equal(commandSchema.safeParse({ ...task, member_id: "invalid" }).success, false);
  assert.equal(commandSchema.safeParse({ ...task, target_date: "2026-02-30" }).success, false);
});