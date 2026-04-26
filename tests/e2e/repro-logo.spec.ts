import { test } from '@playwright/test';
import path from 'path';

const OUT = path.resolve(__dirname, '../../shots');

test('logo + theme', async ({ page }) => {
  // Reset profile so we hit a clean state.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('SparkLabDB');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Profile selector page (clean state)
  await page.screenshot({ path: `${OUT}/01-profile-selector.png`, fullPage: true });

  // Create profile
  const newPlayer = page.locator('button:has-text("New Player")').first();
  if (await newPlayer.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newPlayer.click();
    await page.waitForTimeout(400);
    await page.locator('input[type="text"]').first().fill('M');
    await page.locator('button:has-text("Create")').last().click();
    await page.waitForTimeout(1500);
  }
  // MainMenu
  await page.waitForFunction(
    () => document.querySelectorAll('a').length >= 3,
    null,
    { timeout: 8000 }
  ).catch(() => {});
  await page.screenshot({ path: `${OUT}/02-main-menu.png`, fullPage: true });

  // Worlds list
  await page.evaluate(() => {
    const a = document.querySelector('a[href="/worlds"]') as HTMLAnchorElement | null;
    a?.click();
  });
  await page.waitForURL('**/worlds', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/03-worlds.png`, fullPage: true });
});
