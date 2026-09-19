import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const request = (path, options = {}) =>
  fetch(base + path, { redirect: "manual", ...options });
const login = (username, password, extra = {}) =>
  request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify({ username, password }),
  });
for (const path of [
  "/api/workspace",
  "/api/tasks/00000000-0000-4000-8000-000000000000",
  "/api/attachments/00000000-0000-4000-8000-000000000000",
])
  assert.equal((await request(path)).status, 401);
assert.equal(
  (
    await request("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  ).status,
  401,
);
const redirect = await request("/projects/test");
assert.equal(redirect.status, 307);
assert.match(redirect.headers.get("location"), /\/login/);
assert.equal((await login("wrong", "wrong")).status, 401);
assert.equal(
  (
    await login(process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD, {
      Origin: "https://evil.example",
    })
  ).status,
  403,
);
const r = await login(process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD);
assert.equal(r.status, 200);
const set = r.headers.get("set-cookie");
assert.match(set, /HttpOnly/i);
assert.match(set, /SameSite=strict/i);
assert.match(set, /Max-Age=28800/i);
const cookie = set.split(";")[0];
const token = cookie.split("=")[1];
assert.equal(token.split(".").length, 3);
assert.equal(
  (await request("/api/workspace", { headers: { Cookie: cookie } })).status,
  200,
);
assert.equal(
  (
    await request("/api/workspace", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    })
  ).status,
  403,
);
assert.equal(
  (await request("/api/workspace", { headers: { Cookie: cookie + "bad" } }))
    .status,
  401,
);
const claims = JSON.parse(
  Buffer.from(token.split(".")[1], "base64url").toString(),
);
const unsigned =
  Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }),
  ).toString("base64url");
const expired =
  unsigned +
  "." +
  createHmac("sha256", process.env.JWT_SECRET)
    .update(unsigned)
    .digest("base64url");
assert.equal(
  (
    await request("/api/workspace", {
      headers: { Cookie: "daymark_session=" + expired },
    })
  ).status,
  401,
);
const logout = await request("/api/auth/logout", {
  method: "POST",
  headers: { Cookie: cookie },
});
assert.equal(logout.status, 200);
assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);
assert.equal((await request("/api/workspace")).status, 401);
console.log(
  "PASS: protected pages/APIs/files, credentials, JWT cookie, authenticated access, tampered/expired tokens, cross-site rejection, logout.",
);
