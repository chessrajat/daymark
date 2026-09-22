import { test } from "node:test";
import assert from "node:assert/strict";
import { isOverdue, targetDateChange } from "../lib/target-date";

test("overdue dates exclude today, undated and closed tasks", () => {
  assert.equal(isOverdue("2026-09-21", "In progress", "2026-09-22"), true);
  for (const status of ["Completed", "Dropped"]) {
    assert.equal(isOverdue("2026-09-21", status, "2026-09-22"), false);
  }
  for (const date of [null, "2026-09-22", "2026-09-23"]) {
    assert.equal(isOverdue(date, "To do", "2026-09-22"), false);
  }
});

test("history records date changes and clearing, without duplicating unchanged dates", () => {
  assert.equal(targetDateChange("2026-09-22", "2026-09-22"), "");
  assert.equal(targetDateChange(null, null), "");
  assert.equal(targetDateChange(null, "2026-09-22"), "Target date changed from Not set to 2026-09-22");
  assert.equal(targetDateChange("2026-09-22", null), "Target date changed from 2026-09-22 to Not set");
});
