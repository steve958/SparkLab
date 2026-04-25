import type { Page, Locator } from "@playwright/test";

export class GamePage {
  readonly page: Page;
  readonly checkButton: Locator;
  readonly missionCompleteOverlay: Locator;
  readonly feedbackToast: Locator;
  readonly atomTray: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkButton = page.locator("text=Check");
    this.missionCompleteOverlay = page.locator("text=Mission Complete!");
    this.feedbackToast = page.locator("[class*='bg-success'], [class*='bg-error']").first();
    this.atomTray = page.locator("text=Atoms:");
  }

  async addAtom(elementSymbol: string) {
    // The atom tray buttons show the symbol as bold text
    await this.page.locator(`button:has-text("${elementSymbol}")`).first().click();
  }

  async clickCheck() {
    await this.checkButton.click();
  }

  async isMissionCompleteVisible(): Promise<boolean> {
    return this.missionCompleteOverlay.isVisible();
  }

  async getFeedbackText(): Promise<string | null> {
    const toast = this.feedbackToast;
    if (await toast.isVisible()) {
      return toast.textContent();
    }
    return null;
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }

  async goBackToWorlds() {
    await this.page.goBack();
  }
}
