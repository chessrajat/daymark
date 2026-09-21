import assert from "node:assert/strict";
const base = "http://localhost:3000";
assert.equal((await fetch(base + "/api/notes")).status, 401);
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: process.env.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const Cookie = login.headers.get("set-cookie").split(";")[0];
const request = (p, o = {}) =>
  fetch(base + p, { ...o, headers: { ...o.headers, Cookie } });
const list = async () => await (await request("/api/notes")).json();
async function save(
  {
    id,
    title = "Test note",
    body = "Remember this",
    question = false,
    files = [],
    remove = [],
  },
  status = 200,
) {
  const f = new FormData();
  if (id) f.set("id", id);
  f.set("title", title);
  f.set("body", body);
  f.set("is_question", String(question));
  for (const name of files)
    f.append("files", new Blob(["contents of " + name]), name);
  for (const a of remove) f.append("remove", a);
  const r = await request("/api/notes", { method: "POST", body: f });
  assert.equal(r.status, status, await r.clone().text());
  return (await r.json()).id;
}
const ids = [];
try {
  const id = await save({ question: true, files: ["a.txt", "b.pdf"] });
  ids.push(id);
  let note = (await list()).find((n) => n.id === id);
  assert.equal(note.is_question, true);
  assert.equal(note.attachments.length, 2);
  const first = note.attachments.find((a) => a.name === "a.txt");
  assert.equal(
    await (await request("/api/attachments/" + first.id)).text(),
    "contents of a.txt",
  );
  const other = await save({ title: "Other note", files: ["other.txt"] });
  ids.push(other);
  const untouched = (await list()).find((n) => n.id === other).attachments[0];
  await save({
    id,
    title: "Edited note",
    body: "Edited content",
    question: false,
    remove: [first.id, untouched.id],
    files: ["c.txt"],
  });
  note = (await list()).find((n) => n.id === id);
  assert.equal(note.title, "Edited note");
  assert.equal(note.body, "Edited content");
  assert.equal(note.is_question, false);
  assert.equal(note.attachments.length, 2);
  assert.equal((await request("/api/attachments/" + first.id)).status, 404);
  assert.equal((await request("/api/attachments/" + untouched.id)).status, 200);
  await save({ id, title: "   " }, 400);
  assert.equal((await list()).find((n) => n.id === id).title, "Edited note");
  const attachments = note.attachments;
  assert.equal(
    (await request("/api/notes?id=" + id, { method: "DELETE" })).status,
    200,
  );
  assert.equal(
    (await list()).some((n) => n.id === id),
    false,
  );
  for (const a of attachments)
    assert.equal((await request("/api/attachments/" + a.id)).status, 404);
  await save({ id }, 404);
  assert.equal(
    (await request("/api/notes?id=" + id, { method: "DELETE" })).status,
    404,
  );
  console.log(
    "PASS: auth, create/list/edit, question toggle, multiple attachments/downloads, scoped removal, validation, delete cascade, missing notes.",
  );
} finally {
  for (const id of ids)
    await request("/api/notes?id=" + id, { method: "DELETE" });
}
