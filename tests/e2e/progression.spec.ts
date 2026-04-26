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

    // The build-atom mission has an explanation quiz that gates the
    // mission-complete overlay. Answer it before asserting completion.
    const quiz = page.getByRole("dialog", { name: /how many protons/i });
    await expect(quiz).toBeVisible();
    await quiz.getByRole("button", { name: "1" }).click();
    await quiz.getByRole("button", { name: "Continue" }).click();

    await expect(game.missionCompleteOverlay).toBeVisible({ timeout: 5000 });

    // f02 is unlocked next, so the post-success button is "Back to world"
    // (it's "Continue" only when there's no next mission). This lands on
    // /worlds?world=foundations which shows the MissionBrowser directly.
    await page.getByRole("button", { name: "Back to world" }).click();
    await page.waitForURL(/\/worlds\?world=foundations/);
    await page.locator("text=Build a Hydrogen Atom").waitFor({ state: "visible" });

    // Verify first mission now shows stars
    const stars = await worlds.getMissionStars("Build a Hydrogen Atom");
    expect(stars).toBeGreaterThanOrEqual(1);

    // Verify second mission is now unlocked
    const isSecondLocked = await worlds.isMissionLocked("Make Water");
    expect(isSecondLocked).toBe(false);
  });
});
