import { test, expect } from "@playwright/test";
import { MainMenuPage } from "./pages/MainMenuPage";
import { WorldsPage } from "./pages/WorldsPage";
import { GamePage } from "./pages/GamePage";

test.describe.skip("Reaction Mission Flow", () => {
  test("reaction mission loads with ledger and equation", async ({ page }) => {
    const menu = new MainMenuPage(page);
    const worlds = new WorldsPage(page);
    const game = new GamePage(page);

    // Intercept missions.json to remove prerequisite from the reaction mission
    await page.route("**/data/missions.json", async (route) => {
      const response = await route.fetch();
      const missions = await response.json();
      const modified = missions.map((m: { missionId: string; prerequisites: string[] }) =>
        m.missionId === "c02_conserve_atoms"
          ? { ...m, prerequisites: [] }
          : m
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(modified),
      });
    });

    await menu.goto();
    await menu.createProfile("ReactionTester");
    await menu.clickPlay();

    await worlds.selectWorld("Core Chemistry");
    await worlds.selectMission("Conserve Atoms");
    await page.waitForURL("/game");

    // Wait for game HUD to load
    await expect(game.atomTray).toBeVisible();

    // Verify reaction equation is displayed
    await expect(page.locator("text=2H₂ + O₂ → 2H₂O")).toBeVisible();

    // Verify atom ledger appears
    await expect(page.locator("text=Reactants")).toBeVisible();
    await expect(page.locator("text=Products")).toBeVisible();

    // Add hydrogen atoms
    await game.addAtom("H");
    await game.addAtom("H");
    await game.addAtom("H");
    await game.addAtom("H");

    // Add oxygen atoms
    await game.addAtom("O");
    await game.addAtom("O");

    // Verify ledger updated
    const ledgerText = await page.locator("text=Not Balanced").isVisible();
    // Ledger may show not balanced until atoms are arranged in zones
    expect(ledgerText).toBe(true);
  });
});
