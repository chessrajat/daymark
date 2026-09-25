import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTaskActivity } from "../lib/task-activity";

test("splits an update from its recorded status, dependency and date changes", () => {
  const activity = parseTaskActivity({
    kind: "update",
    message: "Design is ready for review.\nDevelopment waits for approval.\nStatus changed from In progress to Dependent\nDependency: Waiting for design approval\nTarget date changed from Not set to 2026-09-25",
  });
  assert.equal(activity.note, "Design is ready for review.\nDevelopment waits for approval.");
  assert.deepEqual(activity.changes, [
    { kind: "status", from: "In progress", to: "Dependent" },
    { kind: "dependency", value: "Waiting for design approval" },
    { kind: "targetDate", from: "Not set", to: "2026-09-25" },
  ]);
});

test("keeps ordinary updates intact and preserves multiline dependency reasons", () => {
  assert.deepEqual(parseTaskActivity({ kind: "update", message: "Discussed the next step\nwith the team" }), {
    note: "Discussed the next step\nwith the team", changes: [],
  });
  const result = parseTaskActivity({
    kind: "status",
    message: "Status changed from To do to Dependent\nDependency: Waiting for Sam\non the design file",
  });
  assert.deepEqual(result.changes[1], { kind: "dependency", value: "Waiting for Sam\non the design file" });
});
