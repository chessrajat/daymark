import { chromium } from "playwright";
import assert from "node:assert/strict";
import pg from "pg";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const name = "Module UI verification " + Date.now();
let id;
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

  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.AUTH_USERNAME,
      password: process.env.AUTH_PASSWORD,
    }),
  });
  const session = login.headers.get("set-cookie").split(";")[0];
  const r = await fetch(base + "/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: session },
    body: JSON.stringify({ action: "project", name }),
  });
  id = (await r.json()).id;
  assert.ok(id);
  await page.goto(base + "/projects/" + id);
  await page.getByRole("button", { name: "New module", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Planning");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create module", exact: true })
    .click();
  const sidebar = page.getByRole("complementary", { name: "Project modules" });
  await sidebar.getByRole("link", { name: /Planning/ }).click();
  await page.waitForURL("**/modules/**");
  await page.getByRole("heading", { name: /Planning/ }).waitFor();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const selected = await page
    .getByRole("dialog")
    .locator("select[name=module_id]")
    .evaluate((el) => el.selectedOptions[0].textContent);
  assert.equal(selected, "Planning");
  await page.getByLabel("Task title").fill("Plan module milestones");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("link", { name: /Plan module milestones/ }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: /Plan module milestones/ }).waitFor();
  await page.screenshot({ path: "/tmp/modules-desktop.png", fullPage: true });
  await sidebar.getByRole("link", { name: /No module/ }).click();
  await page.waitForURL("**/modules/unfiled");
  await page.getByRole("heading", { name: "Tasks without a module" }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: /Plan module milestones/ }).count(),
    0,
  );
  await sidebar.getByRole("link", { name: /Planning/ }).click();
  await page.getByRole("link", { name: /Plan module milestones/ }).click();
  await page.getByLabel("Task module", { exact: true }).selectOption("");
  await page
    .getByText("Module changed from Planning to No module", { exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "← Back to tasks", exact: true })
    .click();
  await sidebar.getByRole("link", { name: /No module/ }).click();
  await page.getByRole("link", { name: /Plan module milestones/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/modules-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Permanently delete project" })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByLabel("Project name confirmation").fill(name);
  await page
    .getByRole("button", { name: "Permanently delete project" })
    .click();
  await page.waitForURL(base + "/");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: sidebar module creation/navigation, preselected module task creation, reload persistence, filtering, moving tasks, mobile layout, delete cancellation/confirmation and redirect.",
  );
} finally {
  await browser.close();
  if (id) {
    await pool.query("DELETE FROM tasks WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM projects WHERE id=$1", [id]);
  }
  await pool.end();
}
