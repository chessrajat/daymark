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
let project, team, member, otherTeam, otherMember;
async function command(body, status = 200) {
  const r = await fetch(`${base}/api/workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data.id;
}
try {
  project = await command({
    action: "project",
    name: "Integration test project",
    description: "Automatically removed after verification",
  });
  team = await command({ action: "team", name: "Integration team" });
  otherTeam = await command({ action: "team", name: "Other test team" });
  member = await command({
    action: "member",
    name: "Test member",
    team_id: team,
  });
  otherMember = await command({
    action: "member",
    name: "Second member",
    team_id: team,
  });
  const id = await command({
    action: "task",
    project_id: project,
    title: "Verify complete lifecycle",
  });
  await command({ action: "assign", id, team_id: team, member_id: member });
  let data = await (await fetch(`${base}/api/workspace`)).json();
  const first = data.tasks.find((t) => t.id === id).assigned_at;
  assert.ok(first);
  await command({
    action: "update",
    id,
    message: "Progress is recorded with a timestamp.",
  });
  await command(
    { action: "assign", id, team_id: otherTeam, member_id: member },
    400,
  );
  await command({
    action: "assign",
    id,
    team_id: team,
    member_id: otherMember,
  });
  await command({ action: "status", id, status: "In progress" });
  await command({ action: "day", id, day: "2026-09-18", included: true });
  await command({ action: "day", id, day: "2026-09-18", included: true });
  const form = new FormData();
  form.set("file", new Blob(["Attachment verification"]), "test.txt");
  assert.equal(
    (await fetch(`${base}/api/tasks/${id}`, { method: "POST", body: form }))
      .status,
    200,
  );
  await command({ action: "status", id, status: "Completed" });
  await command({ action: "status", id, status: "Dropped" });
  const events = await (await fetch(`${base}/api/tasks/${id}`)).json();
  assert.equal(events.filter((e) => e.kind === "day").length, 1);
  assert.equal(events.filter((e) => e.kind === "assign").length, 2);
  assert.ok(events.every((e) => !Number.isNaN(Date.parse(e.created_at))));
  assert.ok(
    events.some(
      (e) =>
        e.message.includes("Test member") &&
        e.message.includes("Second member"),
    ),
  );
  const attachment = events.find((e) => e.attachment_id);
  const download = await fetch(
    `${base}/api/attachments/${attachment.attachment_id}`,
  );
  assert.match(download.headers.get("content-disposition"), /attachment/);
  assert.equal(await download.text(), "Attachment verification");
  data = await (await fetch(`${base}/api/workspace`)).json();
  assert.deepEqual(data.tasks.find((t) => t.id === id).my_days, ["2026-09-18"]);
  await command({ action: "day", id, day: "2026-09-18", included: false });
  await command({ action: "assign", id, team_id: null, member_id: null });
  data = await (await fetch(`${base}/api/workspace`)).json();
  assert.equal(data.tasks.find((t) => t.id === id).assigned_at, null);
  assert.deepEqual(data.tasks.find((t) => t.id === id).my_days, []);
  await command({ action: "update", id, message: " " }, 400);
  assert.equal((await fetch(`${base}/api/attachments/not-a-uuid`)).status, 400);

  await command({ action: "assign", id, team_id: team, member_id: member });
  data = await (await fetch(base + "/api/workspace")).json();
  const retainedAge = data.tasks.find((t) => t.id === id).assigned_at;
  await command(
    { action: "remove_member", id: member, team_id: otherTeam },
    409,
  );
  await command({ action: "remove_member", id: member, team_id: team });
  data = await (await fetch(base + "/api/workspace")).json();
  assert.equal(data.members.find((m) => m.id === member).team_id, null);
  assert.equal(data.tasks.find((t) => t.id === id).team_id, null);
  assert.equal(data.tasks.find((t) => t.id === id).member_id, member);
  assert.equal(data.tasks.find((t) => t.id === id).assigned_at, retainedAge);
  await command({ action: "remove_member", id: member, team_id: team }, 409);
  const queue = await command({
    action: "task",
    project_id: project,
    title: "Team queue preservation",
  });
  await command({
    action: "assign",
    id: queue,
    team_id: team,
    member_id: null,
  });
  const owned = await command({
    action: "task",
    project_id: project,
    title: "Member ownership preservation",
  });
  await command({
    action: "assign",
    id: owned,
    team_id: team,
    member_id: otherMember,
  });
  await command({ action: "delete_team", id: team });
  data = await (await fetch(base + "/api/workspace")).json();
  assert.equal(
    data.teams.some((t) => t.id === team),
    false,
  );
  assert.equal(data.members.find((m) => m.id === otherMember).team_id, null);
  assert.equal(data.tasks.find((t) => t.id === queue).team_id, null);
  assert.equal(data.tasks.find((t) => t.id === queue).assigned_at, null);
  assert.equal(data.tasks.find((t) => t.id === owned).member_id, otherMember);
  assert.equal(data.tasks.find((t) => t.id === owned).team_id, null);
  assert.ok(data.tasks.find((t) => t.id === owned).assigned_at);
  const queueEvents = await (await fetch(base + "/api/tasks/" + queue)).json();
  assert.ok(
    queueEvents.some((e) =>
      e.message.includes('Team "Integration team" deleted'),
    ),
  );
  const memberEvents = await (await fetch(base + "/api/tasks/" + id)).json();
  assert.ok(memberEvents.some((e) => e.message.includes("removed from team")));
  assert.ok(memberEvents.some((e) => e.attachment_id));
  await command({ action: "delete_team", id: team }, 404);
  await command({ action: "delete_team", id: otherTeam });
  console.log(
    "PASS: remove member, stale membership rejection, delete populated and empty teams, preserve tasks/owners/age/attachments, timeline history.",
  );
  console.log(
    "PASS: project, teams, members, assignment validation, reassignment, statuses, timeline, attachment round-trip, My Day idempotency/removal, unassignment, input validation.",
  );
} finally {
  if (project) {
    await pool.query("DELETE FROM tasks WHERE project_id=$1", [project]);
    await pool.query("DELETE FROM projects WHERE id=$1", [project]);
  }
  for (const id of [member, otherMember].filter(Boolean))
    await pool.query("DELETE FROM members WHERE id=$1", [id]);
  for (const id of [team, otherTeam].filter(Boolean))
    await pool.query("DELETE FROM teams WHERE id=$1", [id]);
  await pool.end();
}
