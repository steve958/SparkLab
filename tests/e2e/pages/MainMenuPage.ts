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
    this.playButton = page.getByRole("link", { name: "Play" });
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
    await this.welcomeMessage.waitFor();
  }

  async clickPlay() {
    await this.playButton.click();
    await this.page.waitForURL("/worlds");
  }
}
