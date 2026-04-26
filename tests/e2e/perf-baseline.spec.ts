// Phase 1 perf baseline probe — measure load and FPS across key routes.
// Manual-run only (skipped in normal suites). Run with:
//   npx playwright test --grep @perf
// Findings captured in docs/phase1-perf-baseline.md.
import { test, expect } from "@playwright/test";

test.describe.skip("Perf baseline (Phase 1) @perf", () => {
  test("home + worlds + game route metrics", async ({ page }) => {
    const log: string[] = [];
    const measure = async (name: string, ready: () => Promise<void>) => {
      const t0 = Date.now();
      await ready();
      const dcl = Date.now() - t0;
      await page.waitForLoadState("load");
      const load = Date.now() - t0;
      const transfer = await page.evaluate(() => {
        const entries = performance.getEntriesByType(
          "resource"
        ) as PerformanceResourceTiming[];
        return entries.reduce((s, e) => s + (e.transferSize || 0), 0);
      });
      const line = `[PERF] ${name.padEnd(12)} dcl=${String(dcl).padStart(
        5
      )}ms  load=${String(load).padStart(5)}ms  transfer=${(
        transfer / 1024
      ).toFixed(0)}KB`;
      log.push(line);
      console.log(line);
    };

    await measure("home", () =>
      page.goto("/", { waitUntil: "domcontentloaded" }).then(() => {})
    );

    // Create profile so gated routes work
    const newPlayer = page.locator('button:has-text("New Player")').first();
    if (await newPlayer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newPlayer.click();
      await page.locator('input[type="text"]').first().fill("Perf");
      await page.locator('button:has-text("Create")').last().click();
      await page.waitForTimeout(600);
    }

    for (const path of [
      "/periodic-table",
      "/settings",
      "/dashboard",
      "/worlds",
    ]) {
      await measure(path, () =>
        page.goto(path, { waitUntil: "domcontentloaded" }).then(() => {})
      );
    }

    // Game boot + FPS sample — use the proven flow from progression.spec.ts.
    const t0 = Date.now();
    await page.goto("/worlds", { waitUntil: "load" });
    await page.locator("text=Choose a World").waitFor({ timeout: 10000 });
    await page.locator("text=Foundations").first().click();
    const missionBtn = page.locator(
      'button:has-text("Build a Hydrogen Atom")'
    );
    await missionBtn.waitFor({ state: "visible", timeout: 10000 });
    await missionBtn.click();
    await page.waitForSelector("canvas", { timeout: 15000 });
    const gameBoot = Date.now() - t0;

    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          function tick() {
            frames++;
            if (performance.now() - start < 2000) {
              requestAnimationFrame(tick);
            } else {
              resolve(frames / 2);
            }
          }
          requestAnimationFrame(tick);
        })
    );

    const gameLine = `[PERF] /game        boot=${String(gameBoot).padStart(
      5
    )}ms  fps=${fps.toFixed(1)} (idle scene)`;
    log.push(gameLine);
    console.log(gameLine);

    // Add a small atom load and measure FPS again to check for degradation
    for (let i = 0; i < 8; i++) {
      await page.locator('button[aria-label="Add Hydrogen atom"]').click();
    }
    const fpsLoaded = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          function tick() {
            frames++;
            if (performance.now() - start < 2000) {
              requestAnimationFrame(tick);
            } else {
              resolve(frames / 2);
            }
          }
          requestAnimationFrame(tick);
        })
    );
    const loadedLine = `[PERF] /game        fps=${fpsLoaded.toFixed(
      1
    )} (8 atoms)`;
    log.push(loadedLine);
    console.log(loadedLine);

    expect(true).toBe(true);
  });
});
