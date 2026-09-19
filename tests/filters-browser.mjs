import { chromium } from "playwright";
import assert from "node:assert/strict";
import pg from "pg";
const base = process.env.TEST_BASE_URL;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let project, team, member;
const name = "Filter check " + Date.now();
async function cmd(body) {
  const r = await page.request.post(base + "/api/workspace", { data: body });
  assert.equal(r.status(), 200, await r.text());
  return (await r.json()).id;
}
try {
  await page.goto(base + "/login");
  await page
    .getByLabel("Username", { exact: true })
    .fill(process.env.AUTH_USERNAME);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(base + "/");
  project = await cmd({ action: "project", name });
  team = await cmd({ action: "team", name });
  member = await cmd({
    action: "member",
    name: name + " member",
    team_id: team,
  });
  const module = await cmd({
    action: "module",
    project_id: project,
    name: "Planning",
  });
  const high = await cmd({
    action: "task",
    project_id: project,
    module_id: module,
    title: name + " high",
    priority: "High",
  });
  const low = await cmd({
    action: "task",
    project_id: project,
    title: name + " low",
    priority: "Low",
  });
  await cmd({ action: "assign", id: high, team_id: team, member_id: member });
  await cmd({ action: "assign", id: low, team_id: null, member_id: member });
  await page.goto(base + "/teams");
  await page
    .getByRole("link", {
      name: "View tasks for " + name + " member",
      exact: true,
    })
    .click();
  await page.waitForURL("**/tasks?member=*");
  assert.equal(await page.getByLabel("Filter by member").inputValue(), member);
  await page.getByRole("link", { name: new RegExp(name + " high") }).waitFor();
  await page.getByRole("link", { name: new RegExp(name + " low") }).waitFor();
  await page.getByLabel("Filter by priority").selectOption("High");
  await page.waitForURL("**priority=High");
  assert.equal(
    await page.getByRole("link", { name: new RegExp(name + " low") }).count(),
    0,
  );
  await page.reload();
  await page.getByRole("link", { name: new RegExp(name + " high") }).waitFor();
  assert.equal(
    await page.getByLabel("Filter by priority").inputValue(),
    "High",
  );
  await page.getByLabel("Filter by status").selectOption("Completed");
  await page.waitForURL("**status=Completed");
  await page.getByText("No matching tasks", { exact: true }).waitFor();
  await page.goBack();
  await page.getByRole("link", { name: new RegExp(name + " high") }).waitFor();
  await page.getByLabel("Filter by project").selectOption(project);
  await page.waitForURL("**project=*");
  await page.getByLabel("Filter by module").selectOption(module);
  await page.waitForURL("**module=*");
  await page.getByRole("link", { name: new RegExp(name + " high") }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.waitForURL(base + "/tasks");
  assert.equal(await page.getByLabel("Filter by member").inputValue(), "");
  await page.goto(base + "/tasks?team=" + team);
  await page.getByRole("link", { name: new RegExp(name + " low") }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: member/team links, combined filters, empty results, URL reload/back, clear filters, team membership matching, mobile width.",
  );
} finally {
  if (project)
    await cmd({ action: "delete_project", id: project, confirmation: name });
  if (team) await cmd({ action: "delete_team", id: team });
  // The app intentionally has no delete-person operation; remove this test-only member through SQL below.
  if (member) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query("DELETE FROM members WHERE id=$1", [member]);
    await pool.end();
  }
  await browser.close();
}
