import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const login = await fetch(base + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: process.env.AUTH_USERNAME, password: process.env.AUTH_PASSWORD }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const request = (path, options = {}) => fetch(base + path, { ...options, headers: { ...options.headers, Cookie: cookie } });
async function command(body) {
  const response = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).id;
}


const { Pool } = await import("pg");
const { mkdir, writeFile } = await import("node:fs/promises");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prefix = "Reports check " + Date.now();
const projects = [];
let team, member;
const preview = async (filters = {}, expected = 200) => {
  const response = await request("/api/reports?" + new URLSearchParams({ today: "2026-09-29", time_zone: "Asia/Calcutta", ...filters }));
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
};
try {
  for (const suffix of [" A", " B"]) projects.push({ id: await command({ action: "project", name: prefix + suffix }), name: prefix + suffix });
  const project = projects[0].id;
  const module = await command({ action: "module", project_id: project, name: "Design and verification" });
  team = await command({ action: "team", name: prefix + " Team" });
  member = await command({ action: "member", name: "Alex", team_id: team });
  const blocked = await command({ action: "task", project_id: project, title: "Overdue review café résumé", target_date: "2026-09-20", priority: "High", day: "2026-09-29" });
  await command({ action: "status", id: blocked, status: "Dependent", dependency_reason: ("Waiting for design approval. ").repeat(60) + "End of dependency reason." });
  const verification = await command({ action: "task", project_id: project, module_id: module, title: "Verification task", member_id: member, target_date: "2026-09-29" });
  await command({ action: "status", id: verification, status: "Under verification" });
  const completed = await command({ action: "task", project_id: project, title: "Completed task", target_date: "2026-09-20" });
  await command({ action: "status", id: completed, status: "Completed" });
  const dropped = await command({ action: "task", project_id: project, title: "Dropped task", target_date: "2026-09-20" });
  await command({ action: "status", id: dropped, status: "Dropped" });
  const teamTask = await command({ action: "task", project_id: project, title: "Team assigned task", priority: "Low", target_date: "2026-10-05" });
  await command({ action: "assign", id: teamTask, member_id: null, team_id: team });
  await command({ action: "task", project_id: projects[1].id, title: "Other project undated task" });
  await pool.query("UPDATE tasks SET created_at='2026-09-28T23:30:00Z', updated_at='2026-09-28T23:30:00Z' WHERE id=$1", [verification]);
  await pool.query("INSERT INTO tasks(project_id,title,description,target_date) SELECT $1, 'Pagination task ' || lpad(n::text,3,'0') || ' with a longer title to verify readable wrapping across exported report pages', 'Literal search 100% complete', '2026-10-10'::date FROM generate_series(1,102) n", [project]);
  const all = await preview({ project, status: "all" });
  assert.equal(all.total, 107);
  assert.equal(all.rows.length, 100);
  assert.equal(all.summary.completed, 1);
  assert.equal(all.summary.verification, 1);
  assert.equal(all.summary.waiting, 1);
  assert.equal(all.summary.overdue, 1);
  assert.equal((await preview({ project })).total, 106);
  assert.equal((await preview({ project, status: "all", date_field: "created" })).total, 107);
  assert.equal((await preview({ project, status: "all", date_field: "updated" })).total, 107);
  const overdue = await preview({ project, type: "overdue", status: "all" });
  assert.deepEqual(overdue.rows.map(r => r.id), [blocked]);
  assert.equal((await preview({ project, module, status: "all" })).rows[0].id, verification);
  assert.equal((await preview({ project, module: "none", status: "all" })).total, 106);
  assert.equal((await preview({ project, member, status: "all" })).total, 1);
  assert.equal((await preview({ project, team, status: "all" })).total, 2);
  assert.equal((await preview({ project, team: "none", status: "all" })).total, 105);
  assert.equal((await preview({ project, assignment: "unassigned", status: "all" })).total, 105);
  assert.equal((await preview({ project, priority: "High" })).rows[0].id, blocked);
  assert.equal((await preview({ project, due: "today" })).rows[0].id, verification);
  assert.equal((await preview({ project: projects[1].id, due: "undated" })).total, 1);
  assert.equal((await preview({ project, from: "2026-09-29", to: "2026-09-29" })).rows[0].id, verification);
  assert.equal((await preview({ project, date_field: "created", from: "2026-09-29", to: "2026-09-29", query: "Verification task" })).total, 1);
  assert.equal((await preview({ project, date_field: "created", time_zone: "UTC", from: "2026-09-29", to: "2026-09-29", query: "Verification task" })).total, 0);
  assert.equal((await preview({ project, date_field: "updated", from: "2026-09-29", to: "2026-09-29", query: "Verification task" })).total, 1);
  assert.equal((await preview({ project, my_day: "2026-09-29" })).rows[0].id, blocked);
  assert.equal((await preview({ project, query: "100%" })).total, 102);
  const workload = await preview({ project, type: "workload", status: "all" });
  assert.equal(workload.summary.workload.reduce((n,g) => n + g.total,0), 107);
  assert.equal(workload.summary.workload.find(g => g.name === "Alex").verification, 1);
  for (const invalid of [{ project: "invalid" }, { type: "unknown" }, { from: "2026-10-01", to: "2026-09-01" }, { from: "2026-02-30" }, { time_zone: "Invalid" }, { format: "csv" }]) await preview(invalid, 400);
  const unauth = await fetch(base + "/api/reports?today=2026-09-29&format=pdf");
  assert.equal(unauth.status, 401);
  const page = await request("/reports");
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("Task reports"));
  for (const type of ["tasks", "status", "workload", "overdue", "empty"]) {
    const response = await request("/api/reports?" + new URLSearchParams({ project, status: "all", today: "2026-09-29", time_zone: "Asia/Calcutta", type: type === "empty" ? "tasks" : type, format: "pdf", ...(type === "empty" ? { query: "No matching tasks anywhere" } : {}) }));
    assert.equal(response.status, 200, response.ok ? "" : await response.clone().text());
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.ok(response.headers.get("content-disposition").includes("attachment;"));
    assert.ok(response.headers.get("cache-control").includes("no-store"));
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0,4).toString(), "%PDF");
    assert.ok(pdf.length > 5000);
    if (process.env.REPORT_OUTPUT_DIR) {
      await mkdir(process.env.REPORT_OUTPUT_DIR, { recursive: true });
      await writeFile(process.env.REPORT_OUTPUT_DIR + "/report-" + type + ".pdf", pdf);
    }
  }
  await pool.query("INSERT INTO tasks(project_id,title) SELECT $1, 'Report limit check ' || n FROM generate_series(1,5001) n", [projects[1].id]);
  await preview({ project: projects[1].id }, 422);
  console.log("PASS: report filters, summaries, timezone date ranges, preview pagination, PDF types, empty exports, auth, validation, export limit and Reports route.");
} finally {
  for (const project of projects) await command({ action: "delete_project", id: project.id, confirmation: project.name });
  if (team) await command({ action: "delete_team", id: team });
  if (member) await command({ action: "delete_member", id: member });
  await pool.end();
}
