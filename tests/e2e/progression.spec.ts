import { test, expect } from "@playwright/test";
import { MainMenuPage } from "./pages/MainMenuPage";
import { WorldsPage } from "./pages/WorldsPage";
import { GamePage } from "./pages/GamePage";

test.describe("Progression and Unlocking", () => {
  test("completing a mission shows stars and unlocks next mission", async ({ page }) => {
    const menu = new MainMenuPage(page);
    const worlds = new WorldsPage(page);
    const game = new GamePage(page);

    await menu.goto();
    await menu.createProfile("ProgressTester");
    await menu.clickPlay();

    // Complete the first mission
    await worlds.selectWorld("Foundations");
    await worlds.selectMission("Build a Hydrogen Atom");

    await expect(game.atomTray).toBeVisible();
    await game.addAtom("H");
    await game.clickCheck();

    await expect(game.missionCompleteOverlay).toBeVisible({ timeout: 5000 });

    // Click Continue to return to worlds page
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/worlds");

    // Verify world progress bar shows progress on the worlds page (Foundations should show 20%)
    await expect(page.locator("text=20%").first()).toBeVisible();

    // Re-select the world and wait for mission browser
    await worlds.selectWorld("Foundations");
    await page.locator("text=Build a Hydrogen Atom").waitFor({ state: "visible" });

    // Verify first mission now shows stars
    const stars = await worlds.getMissionStars("Build a Hydrogen Atom");
    expect(stars).toBeGreaterThanOrEqual(1);

    // Verify second mission is now unlocked
    const isSecondLocked = await worlds.isMissionLocked("Make Water");
    expect(isSecondLocked).toBe(false);
  });
});
