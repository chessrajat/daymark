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
const name = "Activity pagination " + Date.now();
const project = await command({ action: "project", name });
try {
  const id = await command({ action: "task", project_id: project, title: "History" });
  for (let i = 0; i < 51; i++) await command({ action: "update", id, message: "Update " + i });
  const page = async (cursor) => {
    const r = await request("/api/tasks/" + id + "?page=1" + (cursor ? "&before=" + cursor : ""));
    assert.equal(r.status, 200);
    return r.json();
  };
  const latest = await page();
  assert.equal(latest.events.length, 25);
  assert.equal(latest.events.at(-1).message, "Update 50");
  const middle = await page(latest.nextCursor);
  assert.equal(middle.events.length, 25);
  const oldest = await page(middle.nextCursor);
  assert.equal(oldest.events.length, 2);
  assert.equal(oldest.nextCursor, null);
  const merged = [...oldest.events, ...middle.events, ...latest.events];
  assert.equal(new Set(merged.map(e => e.id)).size, 52);
  const all = await (await request("/api/tasks/" + id)).json();
  assert.deepEqual(merged.map(e => e.id), all.map(e => e.id));
  const form = new FormData();
  form.set("message", "Newest with attachment");
  form.append("files", new Blob(["context"]), "context.txt");
  assert.equal((await request("/api/tasks/" + id, { method: "POST", body: form })).status, 200);
  const refreshed = await page();
  assert.equal(refreshed.events.length, 25);
  assert.equal(refreshed.events.at(-1).message, "Newest with attachment");
  assert.equal(refreshed.events.at(-1).attachments.length, 1);
  const afterInsert = await page(latest.nextCursor);
  assert.deepEqual(afterInsert.events.map(e => e.id), middle.events.map(e => e.id));
  assert.equal((await request("/api/tasks/" + id + "?page=1&before=invalid")).status, 400);
  console.log("PASS: newest 25, older pages, no gaps or duplicates, attachment metadata, stable cursors after new updates.");
} finally {
  await command({ action: "delete_project", id: project, confirmation: name });
}
