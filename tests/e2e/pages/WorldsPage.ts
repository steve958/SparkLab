import type { Page, Locator } from "@playwright/test";

export class WorldsPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("text=Choose a World");
  }

  async selectWorld(name: string) {
    await this.page.locator(`text=${name}`).first().click();
  }

  getMissionCard(title: string): Locator {
    return this.page.locator(`button:has-text("${title}")`);
  }

  async isMissionLocked(title: string): Promise<boolean> {
    const card = this.getMissionCard(title);
    const isDisabled = await card.isDisabled().catch(() => false);
    return isDisabled;
  }

  async getMissionStars(title: string): Promise<number> {
    const card = this.getMissionCard(title);
    const filledStars = await card.locator("svg[class*='fill-yellow-400']").count();
    return filledStars;
  }

  async selectMission(title: string) {
    await this.getMissionCard(title).click();
  }
}
