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


const projectName = "Task list actions check " + Date.now();
let project;
const post = (body) => request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const workspace = async () => (await (await request("/api/workspace")).json());
try {
  project = await command({ action: "project", name: projectName });
  const task = await command({ action: "task", project_id: project, title: "Manage from list", day: "2026-09-29" });
  const other = await command({ action: "task", project_id: project, title: "Keep other task" });
  for (const status of ["In progress", "Blocked", "Dependent", "Under verification", "Completed", "Dropped", "To do"]) {
    if (status === "Dependent") {
      assert.equal((await post({ action: "status", id: task, status })).status, 400);
      assert.equal((await workspace()).tasks.find(t => t.id === task).status, "Blocked");
    }
    await command({ action: "status", id: task, status, ...(status === "Dependent" ? { dependency_reason: "Waiting on review from Alex" } : {}) });
    const current = (await workspace()).tasks.find(t => t.id === task);
    assert.equal(current.status, status);
    assert.equal(current.dependency_reason, status === "Dependent" ? "Waiting on review from Alex" : null);
  }
  const activity = await (await request("/api/tasks/" + task)).json();
  assert.equal(activity.filter(e => e.kind === "status").length, 7);
  await command({ action: "status", id: task, status: "To do" });
  assert.equal((await (await request("/api/tasks/" + task)).json()).length, activity.length);
  assert.equal((await post({ action: "status", id: task, status: "Unknown" })).status, 400);
  const form = new FormData();
  form.set("message", "Update and attachment to remove");
  form.set("status", "Under verification");
  form.append("files", new Blob(["Test task attachment"], { type: "text/plain" }), "delete-check.txt");
  const attached = await request("/api/tasks/" + task, { method: "POST", body: form });
  assert.equal(attached.status, 200, await attached.clone().text());
  assert.equal((await workspace()).tasks.find(t => t.id === task).status, "Under verification");
  const before = await (await request("/api/tasks/" + task)).json();
  const attachment = before.flatMap(e => e.attachments).find(a => a.name === "delete-check.txt");
  assert.ok(attachment);
  const unauth = await fetch(base + "/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_task", id: task }) });
  assert.equal(unauth.status, 401);
  assert.equal((await post({ action: "delete_task", id: "invalid" })).status, 400);
  await command({ action: "delete_task", id: task });
  const after = await workspace();
  assert.ok(!after.tasks.some(t => t.id === task));
  assert.equal(after.tasks.find(t => t.id === other).title, "Keep other task");
  assert.deepEqual(await (await request("/api/tasks/" + task)).json(), []);
  assert.equal((await request("/api/attachments/" + attachment.id)).status, 404);
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const table of ["my_days", "events", "attachments"]) {
      const result = await pool.query("SELECT count(*)::integer AS count FROM " + table + " WHERE task_id=$1", [task]);
      assert.equal(result.rows[0].count, 0);
    }
    const links = await pool.query("SELECT count(*)::integer AS count FROM event_attachments WHERE attachment_id=$1", [attachment.id]);
    assert.equal(links.rows[0].count, 0);
  } finally { await pool.end(); }
  assert.equal((await post({ action: "delete_task", id: task })).status, 404);
  console.log("PASS: all inline statuses and dependency validation, timeline history, authenticated task deletion and cascading cleanup, other tasks retained.");
} finally {
  if (project) await command({ action: "delete_project", id: project, confirmation: projectName });
}
