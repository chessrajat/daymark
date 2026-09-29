import { test } from "node:test";
import assert from "node:assert/strict";
import { reportSchema, summarizeReport, type ReportRow } from "../lib/reports";
const row = (id: string, status: ReportRow["status"], extra: Partial<ReportRow> = {}): ReportRow => ({
  id, title: "Task", status, priority: "Medium", target_date: null, dependency_reason: null,
  project_name: "Project", module_name: "No module", assignee_name: "Alex", assignee_key: id,
  team_name: "No team", overdue: false, ...extra,
});
test("reports validate calendar ranges, identifiers, time zones, and supported types", () => {
  const input = { today: "2026-09-29" };
  assert.equal(reportSchema.parse(input).status, "not-completed");
  assert.equal(reportSchema.safeParse({ ...input, from: "2026-09-30", to: "2026-09-29" }).success, false);
  assert.equal(reportSchema.safeParse({ ...input, from: "2026-02-30" }).success, false);
  assert.equal(reportSchema.safeParse({ ...input, time_zone: "Asia/Calcutta" }).success, true);
  assert.equal(reportSchema.safeParse({ ...input, time_zone: "Invalid/Zone" }).success, false);
  assert.equal(reportSchema.safeParse({ ...input, project: "invalid" }).success, false);
  assert.equal(reportSchema.safeParse({ ...input, type: "unknown" }).success, false);
});
test("report totals distinguish open, waiting, verification, and finished work without merging same-named assignees", () => {
  const summary = summarizeReport([
    row("one", "Blocked", { overdue: true }), row("one", "Under verification"),
    row("two", "Completed"), row("two", "Dropped"),
    row("unassigned", "Dependent", { assignee_name: "Unassigned", overdue: true }),
  ]);
  assert.equal(summary.total, 5);
  assert.equal(summary.open, 3);
  assert.equal(summary.waiting, 2);
  assert.equal(summary.verification, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.overdue, 2);
  assert.equal(summary.workload.length, 3);
  assert.equal(summary.workload.find((g) => g.open === 2)?.name, "Alex");
  assert.equal(summary.statusCounts.reduce((sum, group) => sum + group.count, 0), summary.total);
  assert.equal(summarizeReport([]).total, 0);
});
