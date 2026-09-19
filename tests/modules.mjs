const nativeFetch = globalThis.fetch;
const loginBase = process.env.TEST_BASE_URL || "http://localhost:3000";
const loginResponse = await nativeFetch(loginBase + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: process.env.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD,
  }),
});
if (!loginResponse.ok)
  throw Error("Test login failed. Set AUTH_USERNAME and AUTH_PASSWORD.");
const sessionCookie = loginResponse.headers.get("set-cookie").split(";")[0];
const fetch = (url, options = {}) =>
  nativeFetch(url, {
    ...options,
    headers: { ...options.headers, Cookie: sessionCookie },
  });
import assert from "node:assert/strict";
import pg from "pg";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const projects = [];
async function cmd(body, status = 200) {
  const r = await fetch(base + "/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result.id;
}
const state = async () => await (await fetch(base + "/api/workspace")).json();
try {
  const p = await cmd({ action: "project", name: "Module deletion test" });
  projects.push(p);
  const other = await cmd({
    action: "project",
    name: "Unrelated project test",
  });
  projects.push(other);
  const legacy = await cmd({
    action: "task",
    project_id: p,
    title: "Existing unfiled task",
  });
  const untouched = await cmd({
    action: "task",
    project_id: other,
    title: "Keep this task",
  });
  const a = await cmd({ action: "module", project_id: p, name: "Design" });
  const b = await cmd({ action: "module", project_id: p, name: "Delivery" });
  const foreign = await cmd({
    action: "module",
    project_id: other,
    name: "Other module",
  });
  await cmd({ action: "module", project_id: p, name: "   " }, 400);
  await cmd(
    {
      action: "task",
      project_id: p,
      module_id: foreign,
      title: "Invalid cross-project task",
    },
    400,
  );
  const task = await cmd({
    action: "task",
    project_id: p,
    module_id: a,
    title: "Module task",
  });
  assert.equal(
    (await state()).tasks.find((t) => t.id === legacy).module_id,
    null,
  );
  await cmd({ action: "move_module", id: legacy, module_id: a });
  await cmd({ action: "move_module", id: task, module_id: foreign }, 400);
  assert.equal((await state()).tasks.find((t) => t.id === task).module_id, a);
  await cmd({ action: "move_module", id: task, module_id: b });
  await cmd({ action: "move_module", id: task, module_id: b });
  await cmd({ action: "move_module", id: legacy, module_id: null });
  const events = await (await fetch(base + "/api/tasks/" + task)).json();
  assert.equal(events.filter((e) => e.kind === "move_module").length, 1);
  assert.ok(
    events.some(
      (e) => e.message.includes("Design") && e.message.includes("Delivery"),
    ),
  );
  await cmd({ action: "day", id: task, day: "2026-09-18", included: true });
  const form = new FormData();
  form.set("message", "Update with attachment");
  form.set("files", new Blob(["Module file"]), "module.txt");
  assert.equal(
    (await fetch(base + "/api/tasks/" + task, { method: "POST", body: form }))
      .status,
    200,
  );
  const attachment = (
    await (await fetch(base + "/api/tasks/" + task)).json()
  ).find((e) => e.attachments?.length).attachments[0].id;
  await cmd(
    { action: "delete_project", id: p, confirmation: "Wrong name" },
    400,
  );
  assert.ok((await state()).projects.some((x) => x.id === p));
  await cmd({
    action: "delete_project",
    id: p,
    confirmation: "Module deletion test",
  });
  const data = await state();
  assert.equal(
    data.projects.some((x) => x.id === p),
    false,
  );
  assert.equal(
    data.modules.some((x) => x.project_id === p),
    false,
  );
  assert.equal(
    data.tasks.some((x) => x.project_id === p),
    false,
  );
  assert.ok(data.tasks.some((x) => x.id === untouched));
  assert.ok(data.modules.some((x) => x.id === foreign));
  for (const table of ["events", "attachments", "my_days"])
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM " + table + " WHERE task_id=$1",
          [task],
        )
      ).rows[0].n,
      0,
    );
  assert.equal(
    (await fetch(base + "/api/attachments/" + attachment)).status,
    404,
  );
  await cmd(
    { action: "delete_project", id: p, confirmation: "Module deletion test" },
    404,
  );
  console.log(
    "PASS: modules, existing unfiled tasks, module moves, cross-project validation, idempotent timeline, deletion confirmation, complete cascading deletion, and unrelated project preservation.",
  );
} finally {
  for (const id of projects) {
    await pool.query("DELETE FROM tasks WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM projects WHERE id=$1", [id]);
  }
  await pool.end();
}
