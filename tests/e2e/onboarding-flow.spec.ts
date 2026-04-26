// Phase 1 onboarding tutorial — verifies the full first-run flow:
// new profile -> intro screen -> first mission -> coachmark -> success ->
// onboardingCompleted flag flipped -> returning visit lands on MainMenu.
import { test, expect } from "@playwright/test";

test.describe("Onboarding tutorial", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Reset any prior state from other tests so we always exercise the
    // new-profile branch of the home page.
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
    await page.reload({ waitUntil: "load" });
  });

  test("new profile sees the intro, completes first mission, and is graduated", async ({
    page,
  }) => {
    const t0 = Date.now();

    // Create a profile
    await page.locator('button:has-text("New Player")').first().click();
    await page.locator('input[type="text"]').first().fill("Newbie");
    await page.locator('button:has-text("Create")').last().click();

    // Onboarding intro renders instead of MainMenu
    await expect(
      page.getByRole("heading", { name: /Hi, Newbie/ })
    ).toBeVisible();

    // Click "Let's go" to load the first mission
    await page.getByRole("button", { name: /Let's go/i }).click();
    await page.waitForURL(/\/game/);
    await page.waitForSelector("canvas", { timeout: 10000 });

    // Coachmark for empty scene shows up
    await expect(page.getByText(/Tap the H button/i)).toBeVisible();

    // Add the H atom — coachmark should switch to "Now tap Check"
    await page
      .getByRole("button", { name: "Add Hydrogen atom" })
      .click();
    await expect(page.getByText(/Now tap Check/i)).toBeVisible();

    // Run Check, answer the quiz, finish the mission
    await page.getByRole("button", { name: "Check" }).click();
    const quiz = page.getByRole("dialog", { name: /how many protons/i });
    await expect(quiz).toBeVisible();
    await quiz.getByRole("button", { name: "1" }).click();
    await quiz.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Mission Complete!/)).toBeVisible({
      timeout: 5000,
    });

    const elapsedSec = (Date.now() - t0) / 1000;
    // Phase 1 user-facing target is "< 3 min". The soft CI budget is 30s
    // so a regression is flagged long before the user-facing target slips.
    expect(elapsedSec).toBeLessThan(30);

    // Returning to home should now show MainMenu, not the intro.
    await page.getByRole("button", { name: /Back to world|Continue/ }).click();
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByText(/Welcome back, Newbie/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Hi, Newbie/ })).toHaveCount(
      0
    );
  });

  test("Skip the tutorial flips the flag without playing", async ({ page }) => {
    await page.locator('button:has-text("New Player")').first().click();
    await page.locator('input[type="text"]').first().fill("Skipper");
    await page.locator('button:has-text("Create")').last().click();

    await page.getByRole("button", { name: /Skip the tutorial/i }).click();

    // Now MainMenu should be visible
    await expect(page.getByText(/Welcome back, Skipper/)).toBeVisible();
  });
});
