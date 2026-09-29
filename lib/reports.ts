import { z } from "zod";
import { statuses, type Task } from "./types";

export const reportTypes = {
  tasks: { title: "Task register", description: "A detailed list of tasks and their current status." },
  status: { title: "Status summary", description: "Task counts and progress across every status." },
  workload: { title: "Assignee workload", description: "Open work, verification, and overdue tasks by assignee." },
  overdue: { title: "Overdue tasks", description: "Unfinished tasks whose target date has passed." },
} as const;
const id = z.union([z.literal(""), z.uuid()]);
const optionalId = z.union([id, z.literal("none")]);
const date = z.union([z.literal(""), z.iso.date()]);
export const reportSchema = z.object({
  type: z.enum(["tasks", "status", "workload", "overdue"]).default("tasks"),
  project: id.default(""), module: optionalId.default(""), team: optionalId.default(""), member: optionalId.default(""),
  assignment: z.enum(["", "unassigned"]).default(""),
  status: z.enum(["all", "not-completed", ...statuses]).default("not-completed"),
  priority: z.enum(["", "Low", "Medium", "High"]).default(""),
  query: z.string().trim().max(200).default(""),
  due: z.enum(["", "overdue", "today", "undated"]).default(""),
  date_field: z.enum(["target", "created", "updated"]).default("target"),
  from: date.default(""), to: date.default(""), my_day: date.default(""),
  today: z.iso.date(),
  time_zone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Choose a valid time zone.").default("UTC"),
  sort: z.enum(["target", "created", "title", "status", "assignee"]).default("target"),
  details: z.enum(["yes", "no"]).default("yes"),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "The end date must be on or after the start date.", path: ["to"] });
export type ReportFilters = z.infer<typeof reportSchema>;
export type ReportRow = {
  id: string; title: string; status: Task["status"]; priority: string; target_date: string | null;
  dependency_reason: string | null; project_name: string; module_name: string;
  assignee_name: string; assignee_key: string; team_name: string; overdue: boolean;
};
export function summarizeReport(rows: ReportRow[]) {
  const statusCounts = statuses.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));
  const groups = new Map<string, { name: string; team: string; total: number; open: number; verification: number; waiting: number; completed: number; overdue: number }>();
  for (const row of rows) {
    const group = groups.get(row.assignee_key) || { name: row.assignee_name, team: row.team_name, total: 0, open: 0, verification: 0, waiting: 0, completed: 0, overdue: 0 };
    group.total++;
    if (!["Completed", "Dropped"].includes(row.status)) group.open++;
    if (row.status === "Under verification") group.verification++;
    if (["Blocked", "Dependent"].includes(row.status)) group.waiting++;
    if (row.status === "Completed") group.completed++;
    if (row.overdue) group.overdue++;
    groups.set(row.assignee_key, group);
  }
  return {
    total: rows.length,
    open: rows.filter((row) => !["Completed", "Dropped"].includes(row.status)).length,
    completed: rows.filter((row) => row.status === "Completed").length,
    verification: rows.filter((row) => row.status === "Under verification").length,
    waiting: rows.filter((row) => ["Blocked", "Dependent"].includes(row.status)).length,
    overdue: rows.filter((row) => row.overdue).length,
    statusCounts,
    workload: [...groups.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name)),
  };
}
export type ReportSummary = ReturnType<typeof summarizeReport>;
export type ReportResult = { rows: ReportRow[]; summary: ReportSummary; filters: string[]; generatedAt: string; total: number };
