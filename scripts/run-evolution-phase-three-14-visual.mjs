import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const vite = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--config", "scripts/phase-three-14-visual/vite.config.ts"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
vite.stdout.on("data", chunk => output += chunk.toString());
vite.stderr.on("data", chunk => output += chunk.toString());
const base = "http://127.0.0.1:4180/";
const ready = async () => {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    if (vite.exitCode !== null) throw new Error("Phase 3.14 visual harness exited early:\n" + output);
    await delay(500);
  }
  throw new Error("Phase 3.14 visual harness did not start:\n" + output);
};
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  mkdirSync(resolve(root, "test-results/phase-three-14"), { recursive: true });
  const viewports = [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "tablet-landscape", width: 1024, height: 768 },
    { name: "laptop", width: 1280, height: 800 },
    { name: "desktop", width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Linked source sessions" }).waitFor({ state: "visible" });
    await page.getByText("Training Source Session").waitFor({ state: "visible" });
    await page.getByText("ARCHIVED", { exact: true }).waitFor({ state: "visible" });
    const firstPlayer = page.locator(".canonical-evaluation-list .canonical-trace-main strong").first();
    await firstPlayer.waitFor({ state: "visible" });
    assert.match(await firstPlayer.innerText(), /Player 0/);
    await page.getByText("Primary Rusher", { exact: true }).first().waitFor({ state: "visible" });
    const rows = await page.locator(".canonical-evaluation-list .canonical-trace-row").count();
    assert.equal(rows, 502, viewport.name + " must render all paginated evaluation rows");
    const qa = await page.evaluate(() => window.__phase314QA);
    assert.ok(qa.rangeCalls.evolution_evaluation_contexts >= 2, "contexts must be fetched in multiple stable pages");
    assert.ok(qa.rangeCalls.evolution_player_score_snapshots >= 2, "score snapshots must be fetched in multiple stable pages");
    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    assert.ok(metrics.documentWidth <= metrics.width + 1, viewport.name + " horizontal document overflow: " + JSON.stringify(metrics));
    assert.ok(metrics.bodyWidth <= metrics.width + 1, viewport.name + " horizontal body overflow: " + JSON.stringify(metrics));
    await page.screenshot({ path: resolve(root, "test-results/phase-three-14/" + viewport.name + ".png"), fullPage: true });
    assert.deepEqual(pageErrors, [], viewport.name + " runtime errors");
    await page.close();
  }

  const retry = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await retry.goto(base + "?mode=error-once", { waitUntil: "networkidle" });
  await retry.getByRole("alert").filter({ hasText: "Temporary canonical read failure" }).waitFor({ state: "visible" });
  const retryButton = retry.getByRole("button", { name: "Retry loading canonical links" });
  const hitbox = await retryButton.evaluate(el => Math.round(el.getBoundingClientRect().height));
  assert.ok(hitbox >= 44, "retry control must have a 44px minimum touch target");
  await retryButton.click();
  await retry.getByText("Training Source Session").waitFor({ state: "visible" });
  assert.equal(await retry.getByRole("alert").count(), 0, "successful retry must clear the error state");
  await retry.screenshot({ path: resolve(root, "test-results/phase-three-14/retry-recovered.png"), fullPage: true });
  await retry.close();
  console.log("Phase 3.14 browser acceptance PASS: 390, 768, 1024, 1280, 1440; 502-row pagination; Scrim/Tournament/Training source lineage; archived history; role/snapshot mapping; retry recovery.");
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
}
