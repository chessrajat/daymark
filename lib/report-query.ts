import type { ReportFilters, ReportRow } from "./reports";
import { db } from "./db";

export async function loadReport(filters: ReportFilters) {
  const p = await db();
  const values: string[] = [];
  const clauses: string[] = [];
  const bind = (value: string) => { values.push(value); return `$${values.length}`; };
  const today = bind(filters.today);
  const timezone = filters.date_field !== "target" && (filters.from || filters.to) ? bind(filters.time_zone) : "";
  const overdue = `t.target_date < ${today}::date AND t.status NOT IN ('Completed','Dropped')`;
  if (filters.project) clauses.push(`t.project_id=${bind(filters.project)}::uuid`);
  if (filters.module) clauses.push(filters.module === "none" ? "t.module_id IS NULL" : `t.module_id=${bind(filters.module)}::uuid`);
  if (filters.member) clauses.push(filters.member === "none" ? "t.member_id IS NULL" : `t.member_id=${bind(filters.member)}::uuid`);
  if (filters.team) clauses.push(filters.team === "none" ? "t.team_id IS NULL AND m.team_id IS NULL" : `(t.team_id=${bind(filters.team)}::uuid OR m.team_id=$${values.length}::uuid)`);
  if (filters.assignment === "unassigned") clauses.push("t.member_id IS NULL AND t.team_id IS NULL");
  if (filters.status === "not-completed") clauses.push("t.status <> 'Completed'");
  else if (filters.status !== "all") clauses.push(`t.status=${bind(filters.status)}`);
  if (filters.priority) clauses.push(`t.priority=${bind(filters.priority)}`);
  if (filters.query) clauses.push(`strpos(lower(t.title || ' ' || t.description),lower(${bind(filters.query)})) > 0`);
  if (filters.due === "overdue" || filters.type === "overdue") clauses.push(`(${overdue})`);
  if (filters.due === "today") clauses.push(`t.target_date=${today}::date`);
  if (filters.due === "undated") clauses.push("t.target_date IS NULL");
  const dateField = filters.date_field === "target" ? "t.target_date" : `(t.${filters.date_field === "created" ? "created_at" : "updated_at"} AT TIME ZONE ${timezone})::date`;
  if (filters.from) clauses.push(`${dateField} >= ${bind(filters.from)}::date`);
  if (filters.to) clauses.push(`${dateField} <= ${bind(filters.to)}::date`);
  if (filters.my_day) clauses.push(`EXISTS(SELECT 1 FROM my_days d WHERE d.task_id=t.id AND d.day=${bind(filters.my_day)}::date)`);
  const sort = { target: "t.target_date ASC NULLS LAST", created: "t.created_at DESC", title: "lower(t.title)", status: "t.status", assignee: "assignee_name" }[filters.sort];
  const result = await p.query<ReportRow>(`
    SELECT t.id,t.title,t.status,t.priority,to_char(t.target_date,'YYYY-MM-DD') AS target_date,t.dependency_reason,
      p.name AS project_name,COALESCE(mo.name,'No module') AS module_name,
      COALESCE(m.name,team.name,'Unassigned') AS assignee_name,
      COALESCE(t.member_id::text,t.team_id::text,'unassigned') AS assignee_key,
      COALESCE(team.name,mt.name,'No team') AS team_name,
      COALESCE((${overdue}),false) AS overdue
    FROM tasks t JOIN projects p ON p.id=t.project_id
      LEFT JOIN modules mo ON mo.id=t.module_id LEFT JOIN members m ON m.id=t.member_id
      LEFT JOIN teams team ON team.id=t.team_id LEFT JOIN teams mt ON mt.id=m.team_id
    ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""}
    ORDER BY ${sort},t.id LIMIT 5001`, values);
  if (result.rows.length > 5000) throw Error("This report exceeds 5,000 tasks. Narrow the filters before generating it.");
  const named = (value: string) => value && value !== "none" ? value : null;
  const names = (await p.query<{ project: string | null; module: string | null; team: string | null; member: string | null }>(`
    SELECT (SELECT name FROM projects WHERE id=$1) AS project,
      (SELECT name FROM modules WHERE id=$2) AS module,
      (SELECT name FROM teams WHERE id=$3) AS team,
      (SELECT name FROM members WHERE id=$4) AS member`,
    [named(filters.project), named(filters.module), named(filters.team), named(filters.member)],
  )).rows[0];
  const labels = [`Status: ${filters.status === "all" ? "All statuses" : filters.status === "not-completed" ? "Not completed" : filters.status}`];
  for (const key of ["project", "module", "team", "member"] as const) {
    if (filters[key]) labels.push(`${key[0].toUpperCase() + key.slice(1)}: ${filters[key] === "none" ? "None" : names[key] || "Not found"}`);
  }
  if (filters.assignment) labels.push("Assignment: Unassigned");
  if (filters.priority) labels.push(`Priority: ${filters.priority}`);
  if (filters.query) labels.push(`Search: ${filters.query}`);
  if (filters.due || filters.type === "overdue") labels.push(`Target: ${filters.type === "overdue" ? "overdue" : filters.due}`);
  if (filters.from || filters.to) labels.push(`${filters.date_field} date: ${filters.from || "Any"} to ${filters.to || "Any"}`);
  if (filters.my_day) labels.push(`My Day: ${filters.my_day}`);
  labels.push(`Dates in ${filters.time_zone}; today ${filters.today}`);
  return { rows: result.rows, labels };
}
