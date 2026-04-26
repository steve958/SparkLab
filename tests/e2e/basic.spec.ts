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

test("dashboard requires a parent account", async ({ page }) => {
  // Reset state so we hit the create-account branch.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase("SparkLabDB");
        r.onsuccess = r.onerror = r.onblocked = () => res();
      })
  );
  await page.evaluate(() =>
    window.localStorage.removeItem("sparklab_selected_profile")
  );
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=Grown-up Dashboard")).toBeVisible();

  // First-run: create-account form is shown.
  await page.locator('input[type="email"]').fill("parent@example.com");
  await page.locator('input[type="password"]').fill("longenough123");
  await page.getByRole("button", { name: /create account/i }).click();

  // Now signed in.
  await expect(page.getByText(/Signed in as parent@example.com/)).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("text=Player Profiles")).toBeVisible();

  // Sign out and verify the next visit shows the sign-in form.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(
    page.getByRole("button", { name: /sign in/i })
  ).toBeVisible();

  // Wrong password is rejected.
  await page.locator('input[type="email"]').fill("parent@example.com");
  await page.locator('input[type="password"]').fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });

  // Right password lets us back in.
  await page.locator('input[type="password"]').fill("longenough123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator("text=Player Profiles")).toBeVisible({
    timeout: 10000,
  });
});
