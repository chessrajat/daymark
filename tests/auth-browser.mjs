import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/teams");
  await page.waitForURL("**/login?**");
  await page.getByLabel("Username", { exact: true }).fill("wrong");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText("Invalid username or password.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Username", { exact: true })
    .fill(process.env.AUTH_USERNAME);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(base + "/teams");
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(base + "/login");
  await page.goto(base + "/");
  await page.waitForURL("**/login?**");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login redirect, invalid credentials, correct login, return to requested page, reload persistence, sign out, protected after logout, mobile layout.",
  );
} finally {
  await browser.close();
}
