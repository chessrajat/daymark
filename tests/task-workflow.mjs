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
const name = "Task workflow check " + Date.now();
const project = await command({ action: "project", name });
try {
  const day = "2026-09-22";
  const id = await command({ action: "task", project_id: project, title: "My Day task", day });
  const other = await command({ action: "task", project_id: project, title: "Ordinary task" });
  const workspace = async () => (await (await request("/api/workspace")).json());
  const current = async () => (await workspace()).tasks.find(t => t.id === id);
  const events = async () => (await (await request("/api/tasks/" + id)).json());
  assert.deepEqual((await current()).my_days, [day]);
  assert.deepEqual((await workspace()).tasks.find(t => t.id === other).my_days, []);
  const post = async (status, reason, attachment = false) => {
    const form = new FormData();
    form.set("message", "Progress update");
    if (status !== undefined) form.set("status", status);
    if (reason !== undefined) form.set("dependency_reason", reason);
    if (attachment) form.append("files", new Blob(["Details"]), "details.txt");
    return request("/api/tasks/" + id, { method: "POST", body: form });
  };
  assert.equal((await post("Blocked", undefined, true)).status, 200);
  assert.equal((await current()).status, "Blocked");
  const blocked = (await events()).find(e => e.message.includes("To do to Blocked"));
  assert.equal(blocked.attachments.length, 1);
  const count = (await events()).length;
  assert.equal((await post("Dependent", " ", true)).status, 400);
  assert.equal((await current()).status, "Blocked");
  assert.equal((await events()).length, count);
  assert.equal((await post("Dependent", "Waiting on Sam to finish API task")).status, 200);
  assert.equal((await current()).dependency_reason, "Waiting on Sam to finish API task");
  assert.equal((await post(undefined)).status, 200);
  assert.equal((await current()).status, "Dependent");
  await command({ action: "update", id, message: "API ready", status: "In progress" });
  assert.equal((await current()).status, "In progress");
  assert.equal((await current()).dependency_reason, null);
  await command({ action: "status", id, status: "Dependent", dependency_reason: "Awaiting review from Alex" });
  assert.equal((await current()).dependency_reason, "Awaiting review from Alex");
  await command({ action: "status", id, status: "Completed" });
  assert.equal((await current()).dependency_reason, null);
  assert.ok((await events()).some(e => e.message.includes("Dependency cleared")));
  assert.equal((await post("invalid")).status, 400);
  console.log("PASS: My Day creation, status with attachments, dependency validation and rollback, preserved status, JSON updates, dependency clearing and history.");
} finally {
  await command({ action: "delete_project", id: project, confirmation: name });
}
