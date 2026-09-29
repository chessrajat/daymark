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

const projectName = "Module management check " + Date.now();
let project;
const post = (body) => request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const workspace = async () => (await (await request("/api/workspace")).json());
try {
  project = await command({ action: "project", name: projectName });
  const module = await command({ action: "module", project_id: project, name: "Original" });
  const other = await command({ action: "module", project_id: project, name: "Keep" });
  const task = await command({ action: "task", project_id: project, module_id: module, title: "Retain task", day: "2026-09-29" });
  const otherTask = await command({ action: "task", project_id: project, module_id: other, title: "Unchanged task" });
  await command({ action: "update", id: task, message: "Retain this update" });
  const form = new FormData();
  form.set("message", "Update with attachment");
  form.append("files", new Blob(["Retain this attachment"], { type: "text/plain" }), "module-check.txt");
  const attached = await request("/api/tasks/" + task, { method: "POST", body: form });
  assert.equal(attached.status, 200, await attached.clone().text());
  const before = (await workspace()).modules.find(m => m.id === module);
  await command({ action: "rename_module", id: module, name: "  Renamed  " });
  const renamed = (await workspace()).modules.find(m => m.id === module);
  assert.equal(renamed.name, "Renamed");
  assert.equal(renamed.position, before.position);
  assert.equal((await workspace()).tasks.find(t => t.id === task).module_id, module);
  assert.equal((await post({ action: "rename_module", id: module, name: "   " })).status, 400);
  assert.equal((await post({ action: "rename_module", id: module, name: "x".repeat(201) })).status, 400);
  await command({ action: "delete_module", id: module });
  const result = await workspace();
  assert.ok(!result.modules.some(m => m.id === module));
  assert.equal(result.modules.find(m => m.id === other).name, "Keep");
  const kept = result.tasks.find(t => t.id === task);
  assert.equal(kept.module_id, null);
  assert.equal(kept.project_id, project);
  assert.ok(kept.my_days.includes("2026-09-29"));
  assert.equal(result.tasks.find(t => t.id === otherTask).module_id, other);
  const detail = await (await request("/api/tasks/" + task)).json();
  assert.ok(detail.some(e => e.message === "Retain this update"));
  assert.ok(detail.some(e => e.message.includes("Renamed to No module (module deleted)")));
  const attachment = detail.flatMap(e => e.attachments).find(a => a.name === "module-check.txt");
  assert.ok(attachment);
  const download = await request("/api/attachments/" + attachment.id);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "Retain this attachment");
  assert.equal((await post({ action: "delete_module", id: module })).status, 404);
  assert.equal((await post({ action: "rename_module", id: module, name: "Missing" })).status, 404);
  await command({ action: "delete_module", id: other });
  assert.equal((await workspace()).tasks.find(t => t.id === otherTask).module_id, null);
  console.log("PASS: module rename validation and saved ordering; deletion retains tasks, updates and My Day; other modules unaffected; missing module errors.");
} finally {
  if (project) await command({ action: "delete_project", id: project, confirmation: projectName });
}
