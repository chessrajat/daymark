import { test } from "node:test";
import assert from "node:assert/strict";
import { statusChange, statusUpdateSchema } from "../lib/task-status";
import { commandSchema } from "../lib/validation";

test("dependency requires a reason and clears when work resumes", () => {
  const task = { status: "To do" as const, dependency_reason: null };
  assert.throws(() => statusChange(task, { status: "Dependent", dependency_reason: "  " }));
  const dependent = statusChange(task, { status: "Dependent", dependency_reason: " Waiting on Sam's API " });
  assert.equal(dependent.reason, "Waiting on Sam's API");
  assert.match(dependent.message, /To do to Dependent/);
  const current = { status: dependent.status, dependency_reason: dependent.reason };
  assert.equal(statusChange(current, {}).message, "");
  const resumed = statusChange(current, { status: "In progress" });
  assert.equal(resumed.reason, null);
  assert.match(resumed.message, /Dependency cleared/);
  assert.equal(statusUpdateSchema.safeParse({ status: "unknown" }).success, false);
});

test("task creation supports an optional valid My Day date", () => {
  const task = { action: "task", project_id: "d4d791cb-7ffd-4016-b68e-15b6e413447d", title: "Task" };
  assert.equal(commandSchema.safeParse(task).success, true);
  assert.equal(commandSchema.safeParse({ ...task, day: "2026-09-22" }).success, true);
  assert.equal(commandSchema.safeParse({ ...task, day: "2026-02-30" }).success, false);
});
