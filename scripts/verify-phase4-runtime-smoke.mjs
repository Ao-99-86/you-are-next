import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const VITE_PORT = process.env.PHASE4_SMOKE_PORT ?? "5184";
const PARTY_PORT = "1999";
const BASE_URL = `http://${HOST}:${VITE_PORT}`;
const ROOM_ID = `test_${Date.now()}`;
const SERVER_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[phase4-smoke] ${message}`);
  process.exitCode = 1;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok || (res.status >= 300 && res.status < 400)) return;
    } catch {
      // Keep polling until timeout.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

function spawnProcess(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  return { child, getLogs: () => logs };
}

async function killProcess(proc) {
  if (proc.killed || proc.exitCode !== null) return;
  proc.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => proc.once("exit", resolve)),
    delay(3_000),
  ]);
  if (proc.exitCode === null) proc.kill("SIGKILL");
}

async function runPhase4SmokeTest(browserA, browserB, failures) {
  const contextA = await browserA.newContext();
  const contextB = await browserB.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  for (const page of [pageA, pageB]) {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore WebSocket connection errors to party server during startup
        if (/WebSocket|partysocket|ws:\/\//i.test(text)) return;
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
  }

  // ── Step 1: Both players navigate to lobby ──
  console.log("[phase4-smoke] Step 1: Navigating to lobby...");
  await pageA.goto(`${BASE_URL}/lobby/${ROOM_ID}`, { waitUntil: "domcontentloaded" });
  await pageB.goto(`${BASE_URL}/lobby/${ROOM_ID}`, { waitUntil: "domcontentloaded" });

  // ── Step 2: Enter names and join ──
  console.log("[phase4-smoke] Step 2: Joining room...");
  const nameInputA = pageA.locator('input[placeholder*="name"]');
  await nameInputA.waitFor({ timeout: 10_000 });
  await nameInputA.fill("PlayerA");
  await pageA.locator("button", { hasText: /join/i }).click();
  await delay(500);

  const nameInputB = pageB.locator('input[placeholder*="name"]');
  await nameInputB.waitFor({ timeout: 10_000 });
  await nameInputB.fill("PlayerB");
  await pageB.locator("button", { hasText: /join/i }).click();
  await delay(1000);

  // ── Step 3: Verify both players appear in lobby ──
  console.log("[phase4-smoke] Step 3: Checking player list...");
  const playersTextA = await pageA.locator(".lobby-players").textContent({ timeout: 10_000 }).catch(() => "");
  if (!playersTextA.includes("PlayerA") || !playersTextA.includes("PlayerB")) {
    failures.push(`Lobby player list incomplete on Tab A: "${playersTextA}"`);
  }

  // ── Step 4: Both players ready up ──
  console.log("[phase4-smoke] Step 4: Readying up...");
  await pageA.locator("button", { hasText: /ready/i }).click();
  await delay(300);
  await pageB.locator("button", { hasText: /ready/i }).click();
  await delay(500);

  // ── Step 5: Host starts game ──
  console.log("[phase4-smoke] Step 5: Host starting game...");
  const startBtn = pageA.locator("button", { hasText: /start game/i });
  const startBtnVisible = await startBtn.isVisible().catch(() => false);
  if (startBtnVisible) {
    await startBtn.click();
    await delay(1500);
  } else {
    failures.push("Start button not visible for host (PlayerA).");
    return;
  }

  // ── Step 6: Verify both tabs navigated to game ──
  console.log("[phase4-smoke] Step 6: Checking game navigation...");
  const urlA = pageA.url();
  const urlB = pageB.url();
  if (!urlA.includes(`/play/${ROOM_ID}`)) {
    failures.push(`Tab A did not navigate to play route: ${urlA}`);
  }
  if (!urlB.includes(`/play/${ROOM_ID}`)) {
    failures.push(`Tab B did not navigate to play route: ${urlB}`);
  }

  // Wait for game canvas to render
  await pageA.waitForSelector(".game-canvas", { timeout: 15_000 }).catch(() => {
    failures.push("Game canvas not found on Tab A.");
  });
  await pageB.waitForSelector(".game-canvas", { timeout: 15_000 }).catch(() => {
    failures.push("Game canvas not found on Tab B.");
  });
  await delay(2000);

  // ── Step 7: Verify debug overlay shows multiplayer info ──
  console.log("[phase4-smoke] Step 7: Checking debug overlay...");
  const debugA = await pageA.locator(".debug-overlay").textContent({ timeout: 5_000 }).catch(() => "");
  if (debugA.includes("Remote Players: 1") || debugA.includes("Remote Players:")) {
    console.log("[phase4-smoke]   Remote player count visible in debug overlay.");
  }

  // ── Step 8: Verify HUD is active ──
  console.log("[phase4-smoke] Step 8: Checking HUD...");
  const hudA = await pageA.locator(".hud").textContent({ timeout: 5_000 }).catch(() => "");
  if (!hudA.includes("PHASE") || !hudA.includes("GOAL")) {
    failures.push(`HUD not rendering expected content on Tab A: "${hudA}"`);
  }

  // ── Error check ──
  if (consoleErrors.length > 0) {
    failures.push(`Console errors detected (${consoleErrors.length}).`);
  }
  if (pageErrors.length > 0) {
    failures.push(`Uncaught page errors detected (${pageErrors.length}).`);
  }

  await contextA.close();
  await contextB.close();

  return { consoleErrors, pageErrors };
}

async function main() {
  // Start PartyKit dev server
  console.log("[phase4-smoke] Starting PartyKit dev server...");
  const party = spawnProcess("npx", ["partykit", "dev"], {
    PORT: PARTY_PORT,
  });

  // Start Vite dev server
  console.log("[phase4-smoke] Starting Vite dev server...");
  const vite = spawnProcess("npm", [
    "run", "dev", "--", "--host", HOST, "--port", VITE_PORT, "--strictPort",
  ], {
    VITE_PARTYKIT_HOST: `${HOST}:${PARTY_PORT}`,
  });

  try {
    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS);
    console.log("[phase4-smoke] Vite dev server ready.");
    // Give PartyKit a moment to start
    await delay(2000);
  } catch (err) {
    await killProcess(vite.child);
    await killProcess(party.child);
    throw new Error(
      `Server failed to start.\n${String(err)}\n--- vite logs ---\n${vite.getLogs()}\n--- party logs ---\n${party.getLogs()}`
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });

  const failures = [];

  try {
    const errors = await runPhase4SmokeTest(browser, browser, failures);

    if (errors && errors.consoleErrors.length > 0) {
      console.error("[phase4-smoke] Console error samples:");
      for (const err of errors.consoleErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    if (errors && errors.pageErrors.length > 0) {
      console.error("[phase4-smoke] Page error samples:");
      for (const err of errors.pageErrors.slice(0, 5)) console.error(`  ${err}`);
    }
  } catch (err) {
    failures.push(`Runtime flow failed: ${String(err)}`);
  } finally {
    await browser.close();
    await killProcess(vite.child);
    await killProcess(party.child);
  }

  if (failures.length > 0) {
    fail("Runtime smoke test failed:");
    for (const entry of failures) {
      fail(`- ${entry}`);
    }
    process.exit(1);
  }

  console.log("[phase4-smoke] Passed: Lobby join, ready, start, game navigation, canvas render, HUD active, no errors.");
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
