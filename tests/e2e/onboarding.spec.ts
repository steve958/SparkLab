import { test, expect } from "@playwright/test";
import { MainMenuPage } from "./pages/MainMenuPage";
import { WorldsPage } from "./pages/WorldsPage";

test.describe("Onboarding Flow", () => {
  test("can create a profile and navigate to mission browser", async ({ page }) => {
    const menu = new MainMenuPage(page);
    const worlds = new WorldsPage(page);

    await menu.goto();
    await menu.createProfile("TestPlayer");
    await menu.clickPlay();

    await expect(worlds.heading).toBeVisible();

    await worlds.selectWorld("Foundations");
    await expect(page.locator("text=Build a Hydrogen Atom")).toBeVisible();
    await expect(page.locator("text=Make Water")).toBeVisible();
  });

  test("locked missions show lock icon", async ({ page }) => {
    const menu = new MainMenuPage(page);
    const worlds = new WorldsPage(page);

    await menu.goto();
    await menu.createProfile("LockedTest");
    await menu.clickPlay();
    await worlds.selectWorld("Foundations");

    // First mission should be unlocked
    const isFirstLocked = await worlds.isMissionLocked("Build a Hydrogen Atom");
    expect(isFirstLocked).toBe(false);

    // Later missions should be locked (prerequisites not met)
    const isLaterLocked = await worlds.isMissionLocked("Make Methane");
    expect(isLaterLocked).toBe(true);
  });
});
