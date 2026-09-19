import { chromium } from "playwright";
import assert from "node:assert/strict";
import pg from "pg";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const name = `Browser check ${Date.now()}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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

  await page.goto(base);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A clean workspace for a focused week.");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("Plan the next small step");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("link", { name: /Plan the next small step/ }).click();
  await page
    .getByLabel("Task update", { exact: true })
    .fill("The first milestone is ready to review.");
  await page.getByRole("button", { name: "Post update" }).click();
  await page
    .getByText("The first milestone is ready to review.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Task status", { exact: true })
    .selectOption("In progress");
  await page
    .getByText("Status changed from To do to In progress", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Add to My Day", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from My Day", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "← Back to tasks", exact: true })
    .click();
  await page.screenshot({ path: "/tmp/daymark-desktop.png", fullPage: true });
  await page.getByRole("link", { name: /My Day/ }).click();
  await page.getByRole("link", { name: /Plan the next small step/ }).waitFor();
  await page.waitForURL("**/my-day");
  await page
    .getByRole("heading", { name: "Make room for what matters." })
    .waitFor();
  await page.reload();
  await page.getByRole("link", { name: /Plan the next small step/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/daymark-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile has horizontal overflow",
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "PASS: browser project/task creation, update, status, My Day, persistence after reload, mobile width, no runtime errors.",
  );
} finally {
  await browser.close();
  const result = await pool.query("SELECT id FROM projects WHERE name=$1", [
    name,
  ]);
  for (const p of result.rows) {
    await pool.query("DELETE FROM tasks WHERE project_id=$1", [p.id]);
    await pool.query("DELETE FROM projects WHERE id=$1", [p.id]);
  }
  await pool.end();
}
