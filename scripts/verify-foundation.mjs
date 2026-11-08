import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [tokens, foundation, entry, html, config, dialogHook, shell] = await Promise.all([
  readFile(new URL("../src/styles/tokens.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/foundation.css", import.meta.url), "utf8"),
  readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/useAccessibleDialog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/WorkspaceShell.tsx", import.meta.url), "utf8"),
]);

test("brand palette defines the required deep-onxy, cyan and violet tokens", () => {
  assert.match(tokens, /--brand-onyx-950:\s*#05060b/i);
  assert.match(tokens, /--brand-cyan-400:/i);
  assert.match(tokens, /--brand-violet-400:/i);
  assert.match(tokens, /--color-text-primary:/i);
});

test("interactive controls retain a 44px minimum target", () => {
  assert.match(tokens, /--tap-min:\s*44px/);
  assert.match(foundation, /min-height:\s*var\(--tap-min\)/);
  assert.match(foundation, /\.notice button[\s\S]*?min-height:\s*var\(--tap-min\)/);
});

test("responsive foundation covers phone, tablet and wide desktop layouts", () => {
  assert.match(foundation, /max-width:\s*620px/);
  assert.match(foundation, /min-width:\s*621px\) and \(max-width:\s*1024px/);
  assert.match(foundation, /min-width:\s*1200px/);
  assert.match(foundation, /orientation:\s*landscape/);
});

test("accessibility foundation includes focus visibility and reduced motion", () => {
  assert.match(foundation, /:focus-visible/);
  assert.match(foundation, /prefers-reduced-motion:\s*reduce/);
  assert.match(foundation, /env\(safe-area-inset-bottom\)/);
});

test("application entry mounts the error boundary", () => {
  assert.match(entry, /AppErrorBoundary/);
  assert.match(entry, /<AppErrorBoundary>/);
});

test("document declares mobile viewport and dark theme metadata", () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /name="color-scheme"/);
});

test("Vite config keeps the project on the supported Vite 8 build path", () => {
  assert.match(config, /defineConfig/);
  assert.match(config, /rolldownOptions/);
});

test("shared confirmation dialog supports focus trap, Escape and focus restoration", () => {
  assert.match(dialogHook, /event\.key === "Escape"/);
  assert.match(dialogHook, /event\.key !== "Tab"/);
  assert.match(dialogHook, /previousFocus\?\.isConnected/);
  assert.match(dialogHook, /firstItem\.focus\(\)/);
  assert.match(dialogHook, /lastItem\.focus\(\)/);
});

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f0-9]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("core text and accent colors meet WCAG AA contrast against their intended dark surfaces", () => {
  const pairs = [
    ["#EEF3FF", "#05060B"],
    ["#B0BDD5", "#080B14"],
    ["#8493AD", "#05060B"],
    ["#70D8ED", "#05060B"],
    ["#9B86F4", "#05060B"],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `Insufficient contrast for ${foreground} on ${background}`,
    );
  }
});

test("shared workspace shell owns navigation, active state and sync status", () => {
  assert.match(shell, /aria-label="Workspace"/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /onNavigate\(item\)/);
  assert.match(shell, /aria-live="polite"/);
});
