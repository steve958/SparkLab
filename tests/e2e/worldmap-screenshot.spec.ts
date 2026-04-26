// One-off visual sanity check for the new schematic world map and the
// Phase 1 onboarding + reward-feedback polish. Skipped by default;
// un-skip and run manually to refresh shots/.
import { test } from "@playwright/test";
import path from "path";

const OUT = path.resolve(__dirname, "../../shots");

async function resetState(page: import("@playwright/test").Page) {
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
  await page.reload({ waitUntil: "load" });
}

test.describe.skip("Phase 1 visuals @visual", () => {
  test("world map (clean state, desktop + mobile)", async ({ page }) => {
    await resetState(page);

    await page.locator('button:has-text("New Player")').first().click();
    await page.locator('input[type="text"]').first().fill("Mapper");
    await page.locator('button:has-text("Create")').last().click();
    await page
      .getByRole("button", { name: /Skip the tutorial/i })
      .click({ timeout: 10000 });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('a[href="/worlds"]').click();
    await page.waitForLoadState("load");
    await page.screenshot({
      path: `${OUT}/worldmap-desktop-clean.png`,
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "load" });
    await page.screenshot({
      path: `${OUT}/worldmap-mobile-clean.png`,
      fullPage: true,
    });
  });

  test("onboarding flow + mission-complete overlay (mobile)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetState(page);

    await page.locator('button:has-text("New Player")').first().click();
    await page.locator('input[type="text"]').first().fill("Newbie");
    await page.locator('button:has-text("Create")').last().click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/onboarding-intro-mobile.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /Let's go/i }).click();
    await page.waitForSelector("canvas", { timeout: 15000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/onboarding-coachmark-empty.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "Add Hydrogen atom" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/onboarding-coachmark-has-atom.png`,
      fullPage: true,
    });

    // Mission-complete overlay — first-clear state with star burst.
    await page.getByRole("button", { name: "Check" }).click();
    const quiz = page.getByRole("dialog", { name: /how many protons/i });
    await quiz.getByRole("button", { name: "1" }).click();
    await quiz.getByRole("button", { name: "Continue" }).click();
    await page.waitForSelector("text=Mission Complete!", { timeout: 5000 });
    await page.waitForTimeout(1200); // 3 staggered stars * 200ms + animation
    await page.screenshot({
      path: `${OUT}/mission-complete-first-clear.png`,
      fullPage: true,
    });
  });
});
