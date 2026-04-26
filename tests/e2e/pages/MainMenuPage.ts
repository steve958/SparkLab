import type { Page, Locator } from "@playwright/test";

export class MainMenuPage {
  readonly page: Page;
  readonly newPlayerButton: Locator;
  readonly nameInput: Locator;
  readonly createButton: Locator;
  readonly playButton: Locator;
  readonly welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPlayerButton = page.locator("text=New Player");
    this.nameInput = page.locator('input[placeholder="Enter your name"]');
    this.createButton = page.locator("text=Create");
    // Lab hub has two links that include the word "Play" (current-quest
    // card and the action grid). We target the worlds-route link
    // specifically so the test isn't sensitive to the current-quest
    // race.
    this.playButton = page.locator('a[href="/worlds"]').first();
    this.welcomeMessage = page.locator("text=Welcome back");
  }

  async goto() {
    await this.page.goto("/");
    // Wait for the profile selector or main menu to be ready
    await this.page.getByRole("heading", { name: "Who is playing?" }).waitFor({ state: "visible", timeout: 15000 });
  }

  async createProfile(name: string) {
    await this.newPlayerButton.click();
    await this.nameInput.fill(name);
    await this.createButton.click();
    // New profiles always land on the onboarding intro before MainMenu.
    // The shared helper auto-skips so existing tests behave the same as
    // before. Tests that explicitly cover onboarding
    // (onboarding-flow.spec.ts) call the lower-level steps directly and
    // don't go through this helper.
    await this.page
      .getByRole("button", { name: /Skip the tutorial/i })
      .click({ timeout: 10000 });
    await this.welcomeMessage.waitFor();
  }

  async clickPlay() {
    await this.playButton.click();
    await this.page.waitForURL("/worlds");
  }
}
