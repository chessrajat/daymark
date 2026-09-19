import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let project;
const name = "Task page check " + Date.now();
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
  const task = await cmd({
    action: "task",
    project_id: project,
    title: "Task page workflow",
  });
  const module = await cmd({
    action: "module",
    project_id: project,
    name: "Delivery",
  });
  await page.goto(base + "/tasks?project=" + project);
  await page.getByRole("link", { name: /Task page workflow/ }).click();
  await page.waitForURL("**/tasks/" + task + "?**");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByRole("heading", { name: "Task page workflow", exact: true })
    .waitFor();
  const left = await page
    .getByRole("region", { name: "Task details" })
    .boundingBox();
  const right = await page
    .getByRole("complementary", { name: "Timeline and updates" })
    .boundingBox();
  assert.ok(right.x > left.x);
  await page
    .getByLabel("Task status", { exact: true })
    .selectOption("In progress");
  await page
    .getByText("Status changed from To do to In progress", { exact: true })
    .waitFor();
  await page.getByLabel("Task module", { exact: true }).selectOption(module);
  await page
    .getByText("Module changed from No module to Delivery", { exact: true })
    .waitFor();
  await page
    .getByLabel("Task update", { exact: true })
    .fill("Task page update verified");
  await page.getByRole("button", { name: "Post update" }).click();
  await page.getByText("Task page update verified", { exact: true }).waitFor();
  await page
    .getByLabel("Attach file", { exact: true })
    .setInputFiles({
      name: "page.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Task page attachment"),
    });
  await page.getByRole("link", { name: "page.txt", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Add to My Day", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from My Day", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Edit details/ }).click();
  await page.getByLabel("Title", { exact: true }).fill("Updated task page");
  await page.getByRole("button", { name: "Save details" }).click();
  await page
    .getByRole("heading", { name: "Updated task page", exact: true })
    .waitFor();
  await page.screenshot({ path: "/tmp/task-page-desktop.png", fullPage: true });
  await page.reload();
  await page.getByText("Task page update verified", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "← Back to tasks", exact: true })
    .click();
  await page.waitForURL(base + "/tasks?project=" + project);
  assert.equal(
    await page.getByLabel("Filter by project").inputValue(),
    project,
  );
  await page.goto(base + "/tasks/" + task);
  await page
    .getByRole("heading", { name: "Updated task page", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/task-page-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto(base + "/tasks/00000000-0000-4000-8000-000000000000");
  await page.getByRole("heading", { name: "Task not found" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: task link routing, no dialog, right-hand timeline, status/module/edit/update/upload/My Day, reload/direct links, filtered back link, mobile, missing task.",
  );
} finally {
  if (project)
    await cmd({ action: "delete_project", id: project, confirmation: name });
  await browser.close();
}
