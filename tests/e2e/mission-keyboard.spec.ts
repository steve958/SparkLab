import { test, expect } from "@playwright/test";
import { MainMenuPage } from "./pages/MainMenuPage";
import { WorldsPage } from "./pages/WorldsPage";
import { GamePage } from "./pages/GamePage";

test.describe("Keyboard Mission Completion", () => {
  test("can complete build-atom mission using only keyboard", async ({ page }) => {
    const menu = new MainMenuPage(page);
    const worlds = new WorldsPage(page);
    const game = new GamePage(page);

    await menu.goto();
    await menu.createProfile("KeyboardHero");
    await menu.clickPlay();

    await worlds.selectWorld("Foundations");
    await worlds.selectMission("Build a Hydrogen Atom");

    // Wait for game HUD to load
    await expect(game.atomTray).toBeVisible();

    // Focus the H atom button and press Enter to add it
    await page.getByRole("button", { name: "Add Hydrogen atom" }).focus();
    await page.keyboard.press("Enter");

    // Focus the Check button and press Enter
    await page.getByRole("button", { name: "Check" }).focus();
    await page.keyboard.press("Enter");

    // Verify mission complete overlay appears
    await expect(game.missionCompleteOverlay).toBeVisible({ timeout: 5000 });
  });
});
