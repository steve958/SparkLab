import { test, expect } from "@playwright/test";

test("homepage loads and shows profile selector", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Who is playing?")).toBeVisible();
});

test("can create a profile and navigate to worlds", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("text=Who is playing?").waitFor({ state: "visible", timeout: 15000 });

  // Create profile
  await page.click("text=New Player");
  await page.fill('input[placeholder="Enter your name"]', "TestPlayer");
  await page.click("text=Create");

  // New profiles see the onboarding intro first; bypass it for this test.
  await page.getByRole("button", { name: /Skip the tutorial/i }).click();

  // Should show main menu
  await expect(page.locator("text=Welcome back, TestPlayer!")).toBeVisible();

  // Navigate to worlds
  await Promise.all([
    page.waitForNavigation(),
    page.locator('a[href="/worlds"]').click(),
  ]);
  await expect(page.locator("text=Choose a World")).toBeVisible();
});

test("dashboard requires PIN", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=Grown-up Dashboard")).toBeVisible();

  // Enter wrong PIN
  const pinInput = page.locator('input[inputmode="numeric"]');
  await pinInput.waitFor({ state: "visible" });
  await pinInput.fill("0000");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.locator("text=Incorrect PIN")).toBeVisible({ timeout: 10000 });

  // Enter correct PIN
  await pinInput.fill("1234");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.locator("text=Player Profiles")).toBeVisible({ timeout: 10000 });
});
