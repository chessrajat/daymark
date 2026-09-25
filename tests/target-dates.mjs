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
const dateFromToday = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const first = dateFromToday(2), second = dateFromToday(4), third = dateFromToday(6);
const edited = dateFromToday(8), updated = dateFromToday(9), yesterday = dateFromToday(-1);
const name = "Target dates check " + Date.now();
const project = await command({ action: "project", name });
try {
  const id = await command({ action: "task", project_id: project, title: "Dated task", target_date: first });
  const current = async () => (await (await request("/api/workspace")).json()).tasks.find(t => t.id === id);
  const events = async () => (await (await request("/api/tasks/" + id)).json());
  assert.equal((await current()).target_date, first);
  const post = async (date, message = "Revised estimate", attachment = false) => {
    const form = new FormData(); form.set("message", message);
    if (date !== undefined) form.set("target_date", date);
    if (attachment) form.append("files", new Blob(["supporting detail"]), "context.txt");
    return request("/api/tasks/" + id, { method: "POST", body: form });
  };
  assert.equal((await post(second, "API needs more time", true)).status, 200);
  assert.equal((await current()).target_date, second);
  const changed = (await events()).find(e => e.message.startsWith("API needs more time"));
  assert.ok(changed.message.includes(`${first} to ${second}`));
  assert.equal(changed.attachments.length, 1);
  assert.equal((await post(undefined, "Still working")).status, 200);
  assert.equal((await post(second, "Same date")).status, 200);
  assert.equal((await current()).target_date, second);
  const count = (await events()).length;
  assert.equal((await post("2026-02-30")).status, 400);
  assert.equal((await post(yesterday)).status, 400);
  assert.equal((await current()).target_date, second);
  assert.equal((await post(third, " ")).status, 400);
  assert.equal((await events()).length, count);
  assert.equal((await current()).target_date, second);
  assert.equal((await post("")).status, 200);
  assert.equal((await current()).target_date, null);
  assert.ok((await events()).some(e => e.message.includes(`${second} to Not set`)));
  await command({ action: "edit", id, title: "Dated task", description: "", priority: "Medium", target_date: edited });
  await command({ action: "edit", id, title: "Renamed", description: "", priority: "Low" });
  assert.equal((await current()).target_date, edited);
  await command({ action: "update", id, message: "JSON update", target_date: updated });
  assert.equal((await current()).target_date, updated);
  const rejectedJson = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, message: "Backdate", target_date: yesterday }) });
  assert.equal(rejectedJson.status, 400);
  assert.equal((await current()).target_date, updated);
  const undated = await command({ action: "task", project_id: project, title: "No date" });
  const workspace = await (await request("/api/workspace")).json();
  assert.equal(workspace.tasks.find(t => t.id === undated).target_date, null);
  console.log("PASS: create, edit, multipart and JSON updates, attachment history, omitted/cleared dates, invalid-date rollback, date-only serialization.");
} finally {
  await command({ action: "delete_project", id: project, confirmation: name });
}
