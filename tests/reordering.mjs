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
const prefix = "Reorder check " + Date.now();
const projects = [];
const workspace = async () => (await (await request("/api/workspace")).json());
const names = new Map();
async function createProject(suffix) {
  const name = prefix + suffix;
  const id = await command({ action: "project", name });
  projects.push(id); names.set(id, name); return id;
}
try {
  const a = await createProject(" A"), b = await createProject(" B"), c = await createProject(" C");
  const projectOrder = async () => (await workspace()).projects.filter(p => projects.includes(p.id)).map(p => p.id);
  assert.deepEqual(await projectOrder(), [a,b,c]);
  await command({ action: "move_project", id: c, direction: "up" });
  assert.deepEqual(await projectOrder(), [a,c,b]);
  await command({ action: "move_project", id: a, direction: "down" });
  assert.deepEqual(await projectOrder(), [c,a,b]);
  const d = await createProject(" D");
  assert.deepEqual(await projectOrder(), [c,a,b,d]);
  const m1 = await command({ action: "module", project_id: a, name: "One" });
  const m2 = await command({ action: "module", project_id: a, name: "Two" });
  const m3 = await command({ action: "module", project_id: a, name: "Three" });
  const other = await command({ action: "module", project_id: b, name: "Other project" });
  const moduleOrder = async (project) => (await workspace()).modules.filter(m => m.project_id === project).map(m => m.id);
  await command({ action: "reorder_module", id: m3, direction: "up" });
  assert.deepEqual(await moduleOrder(a), [m1,m3,m2]);
  await command({ action: "reorder_module", id: m1, direction: "down" });
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2]);
  await command({ action: "reorder_module", id: m3, direction: "up" });
  await command({ action: "reorder_module", id: m2, direction: "down" });
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2]);
  const m4 = await command({ action: "module", project_id: a, name: "Four" });
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2,m4]);
  assert.deepEqual(await moduleOrder(b), [other]);
  await command({ action: "place_project", id: d, target_id: c, placement: "before" });
  assert.deepEqual(await projectOrder(), [d,c,a,b]);
  await command({ action: "place_project", id: d, target_id: b, placement: "after" });
  assert.deepEqual(await projectOrder(), [c,a,b,d]);
  await command({ action: "place_module", id: m4, target_id: m3, placement: "before" });
  assert.deepEqual(await moduleOrder(a), [m4,m3,m1,m2]);
  await command({ action: "place_module", id: m4, target_id: m2, placement: "after" });
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2,m4]);
  await command({ action: "place_module", id: m3, target_id: m3, placement: "before" });
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2,m4]);
  const wrongScope = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "place_module", id: m4, target_id: other, placement: "before" }) });
  assert.equal(wrongScope.status, 400);
  assert.deepEqual(await moduleOrder(a), [m3,m1,m2,m4]);
  assert.deepEqual(await moduleOrder(b), [other]);
  const invalid = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move_project", id: a, direction: "sideways" }) });
  assert.equal(invalid.status, 400);
  const missing = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorder_module", id: "00000000-0000-4000-8000-000000000000", direction: "up" }) });
  assert.equal(missing.status, 404);
  console.log("PASS: saved project/module ordering, end placement for new items, module boundaries, scope isolation, invalid and missing items.");
} finally {
  for (const id of projects) await command({ action: "delete_project", id, confirmation: names.get(id) });
}
