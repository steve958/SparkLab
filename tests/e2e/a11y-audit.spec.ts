// Phase 1 accessibility audit (discovery pass) — runs axe-core against every
// route and writes a per-route summary to console. Manual-run only; intended
// to inform docs/phase1-a11y-audit.md, not to gate CI. Findings get fixed in
// product code, not by tweaking this probe.
import { test, expect } from "@playwright/test";
import path from "path";

const AXE_PATH = path.resolve(
  __dirname,
  "../../node_modules/axe-core/axe.min.js"
);

interface AxeResult {
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
  }>;
}

async function runAxe(page: import("@playwright/test").Page) {
  await page.addScriptTag({ path: AXE_PATH });
  return (await page.evaluate(async () => {
    // @ts-expect-error injected at runtime
    const axe = window.axe;
    return axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] },
    });
  })) as AxeResult;
}

function summarize(label: string, result: AxeResult) {
  const counts: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const v of result.violations) {
    const k = v.impact ?? "minor";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  console.log(
    `[A11Y] ${label.padEnd(22)} crit=${counts.critical} serious=${counts.serious} mod=${counts.moderate} minor=${counts.minor}`
  );
  for (const v of result.violations) {
    console.log(
      `[A11Y]   - [${v.impact ?? "minor"}] ${v.id} (${v.nodes.length}x): ${v.help}`
    );
    for (const n of v.nodes.slice(0, 5)) {
      console.log(`[A11Y]       target=${n.target.join(" >> ")}`);
      console.log(`[A11Y]       html=${n.html.slice(0, 160)}`);
    }
  }
}

test.describe.skip("A11y audit (Phase 1) @a11y", () => {
  test("scan every route", async ({ page }) => {
    // Home (no profile)
    await page.goto("/", { waitUntil: "load" });
    summarize("/ (no profile)", await runAxe(page));

    // Create a profile so gated routes render
    const newPlayer = page.locator('button:has-text("New Player")').first();
    if (await newPlayer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newPlayer.click();
      await page.locator('input[type="text"]').first().fill("A11yTester");
      await page.locator('button:has-text("Create")').last().click();
      await page.waitForTimeout(600);
    }

    // Home (with profile -> MainMenu)
    await page.goto("/", { waitUntil: "load" });
    summarize("/ (with profile)", await runAxe(page));

    for (const path of [
      "/worlds",
      "/periodic-table",
      "/settings",
      "/dashboard",
      "/cms",
      "/notebook",
      "/badges",
      "/sandbox",
    ]) {
      await page.goto(path, { waitUntil: "load" });
      // Give the spinner time to resolve and for content to hydrate.
      await page.waitForTimeout(500);
      summarize(path, await runAxe(page));
    }

    // World detail (mission browser)
    await page.goto("/worlds?world=foundations", { waitUntil: "load" });
    await page.waitForTimeout(500);
    summarize("/worlds?world=...", await runAxe(page));

    // Game scene
    await page.locator('button:has-text("Build a Hydrogen Atom")').click();
    await page.waitForSelector("canvas", { timeout: 15000 });
    await page.waitForTimeout(500);
    summarize("/game", await runAxe(page));

    expect(true).toBe(true);
  });
});
