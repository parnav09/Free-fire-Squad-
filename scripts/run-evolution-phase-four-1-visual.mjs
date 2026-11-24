import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const vite = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--config", "scripts/phase-four-1-visual/vite.config.ts"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
vite.stdout.on("data", chunk => output += chunk.toString());
vite.stderr.on("data", chunk => output += chunk.toString());
const base = "http://127.0.0.1:4181/";
const ready = async () => {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    if (vite.exitCode !== null) throw new Error("Phase 4.1 visual harness exited early:\n" + output);
    await delay(500);
  }
  throw new Error("Phase 4.1 visual harness did not start:\n" + output);
};
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  mkdirSync(resolve(root, "test-results/phase-four-1"), { recursive: true });
  const viewports = [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "laptop", width: 1280, height: 800 },
  ];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Start with the session" }).waitFor({ state: "visible" });
    await page.locator(".daily-session-first-refresh:not([disabled])").waitFor({ state: "visible" });
    await page.keyboard.press("Tab");
    const focusStyle = await page.locator(".daily-session-first-refresh").evaluate(el => getComputedStyle(el).outlineStyle);
    assert.equal(focusStyle, "solid", viewport.name + " keyboard focus must be visible");
    const sessionSelect = page.getByLabel(/Canonical session/);
    const matchSelect = page.getByLabel(/Match in this session/);
    const targetSelect = page.getByLabel(/Teammate to evaluate/);
    const sessionOptions = await sessionSelect.locator("option").allTextContents();
    assert.ok(!sessionOptions.some(value => value.includes("Archived Session")), "archived sessions must not appear");
    assert.ok(!sessionOptions.some(value => value.includes("Foreign Team Session")), "other-team sessions must not appear");
    await sessionSelect.selectOption("22222222-2222-4222-8222-222222222222");
    const matchOptions = await matchSelect.locator("option").allTextContents();
    assert.ok(!matchOptions.some(value => value.includes("Foreign Map")), "other-team matches must not appear");
    await matchSelect.selectOption("44444444-4444-4444-8444-444444444444");
    await targetSelect.locator("option").filter({ hasText: "Player A" }).waitFor({ state: "attached" });
    const targetOptions = await targetSelect.locator("option").allTextContents();
    assert.ok(targetOptions.some(value => value.includes("Player A") && value.includes("Primary Rusher")), "latest assigned role must be shown");
    assert.equal(targetOptions.filter(value => value.includes("Player A")).length, 1, "duplicate historical role rows must produce one option");
    for (const forbidden of ["Current User", "Player B", "Inactive Player", "Invalid Role Player", "Foreign Player"]) {
      assert.ok(!targetOptions.some(value => value.includes(forbidden)), forbidden + " must not appear in eligible targets");
    }
    const qa = await page.evaluate(() => window.__phase41QA);
    assert.ok(qa.rangeCalls.canonical_sessions >= 2, "all session pages must be read");
    assert.ok(qa.rangeCalls.canonical_session_matches >= 2, "all match pages must be read");
    assert.ok(qa.rangeCalls.canonical_session_match_roles >= 2, "all role pages must be read");

    await targetSelect.selectOption("player-a");
    await page.getByText("SELECTED EVALUATION CONTEXT").waitFor({ state: "visible" });
    assert.equal(await page.locator(".daily-session-first-role").innerText(), "PRIMARY RUSHER");

    const dimensions = await page.locator(".daily-session-first-fields").evaluate(el => {
      const style = getComputedStyle(el);
      return { columns: style.gridTemplateColumns.split(" ").length };
    });
    assert.equal(dimensions.columns, viewport.width <= 760 ? 1 : 3, viewport.name + " column layout");
    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    assert.ok(metrics.documentWidth <= metrics.width + 1, viewport.name + " horizontal document overflow: " + JSON.stringify(metrics));
    assert.ok(metrics.bodyWidth <= metrics.width + 1, viewport.name + " horizontal body overflow: " + JSON.stringify(metrics));
    const buttonHeights = await page.locator(".daily-session-first button").evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
    assert.ok(buttonHeights.every(height => height >= 44), viewport.name + " buttons must meet the 44px touch target");
    const selectHeight = await sessionSelect.evaluate(el => Math.round(el.getBoundingClientRect().height));
    assert.ok(selectHeight >= 46, viewport.name + " select controls must remain comfortably tappable");
    await page.screenshot({ path: resolve(root, "test-results/phase-four-1/" + viewport.name + ".png"), fullPage: false });

    await sessionSelect.selectOption("33333333-3333-4333-8333-333333333333");
    await matchSelect.locator("option").filter({ hasText: "Purgatory" }).waitFor({ state: "attached" });
    assert.equal(await matchSelect.inputValue(), "", "changing the session must clear the prior match");
    assert.equal(await targetSelect.inputValue(), "", "changing the session must clear the prior target");
    await matchSelect.selectOption("55555555-5555-4555-8555-555555555555");
    await page.getByRole("option", { name: /Player C.*Third Rusher/ }).waitFor({ state: "attached" });
    assert.equal(await targetSelect.locator("option").count(), 2, "the second session exposes only its own eligible teammate");
    assert.deepEqual(pageErrors, [], viewport.name + " runtime errors");
    await page.screenshot({ path: resolve(root, "test-results/phase-four-1/session-switch-" + viewport.name + ".png"), fullPage: false });
    await page.close();
  }

  const retry = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const retryErrors = [];
  retry.on("pageerror", error => retryErrors.push(error.message));
  await retry.goto(base + "?mode=error-once", { waitUntil: "networkidle" });
  await retry.getByRole("alert").filter({ hasText: "Temporary session read failure" }).waitFor({ state: "visible" });
  const retryButton = retry.getByRole("alert").getByRole("button", { name: "Retry" });
  const retryHeight = await retryButton.evaluate(el => Math.round(el.getBoundingClientRect().height));
  assert.ok(retryHeight >= 44, "retry control must meet the 44px touch target");
  await retryButton.click();
  await retry.getByRole("alert").waitFor({ state: "hidden" });
  await retry.getByLabel(/Canonical session/).selectOption("22222222-2222-4222-8222-222222222222");
  await retry.getByLabel(/Match in this session/).selectOption("44444444-4444-4444-8444-444444444444");
  await retry.getByRole("option", { name: /Player A.*Primary Rusher/ }).waitFor({ state: "attached" });
  assert.deepEqual(retryErrors, [], "retry path runtime errors");
  await retry.screenshot({ path: resolve(root, "test-results/phase-four-1/retry-recovered.png"), fullPage: false });
  await retry.close();
  console.log("Phase 4.1 browser acceptance PASS: phone, tablet and laptop layouts; paginated session/match/role reads; self/inactive/unassigned/invalid target exclusion; latest-role precedence; session-change reset; retry recovery.");
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
}
