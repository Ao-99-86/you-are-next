import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = process.env.PHASE2_SMOKE_PORT ?? "5181";
const BASE_URL = `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[phase2-smoke] ${message}`);
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
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function runBranchPlaytest(page, failures) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForSelector(".hud", { timeout: 20_000 });
  await page.waitForSelector(".debug-overlay", { timeout: 20_000 });

  const monsterExists = await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    return !!scene?.getMeshByName("monsterBody");
  });
  if (!monsterExists) {
    failures.push("Monster mesh not found.");
    return;
  }

  const patrolMotion = await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const monster = scene?.getMeshByName("monsterBody");
    if (!monster) return { ok: false, reason: "monster missing" };

    const start = { x: monster.position.x, z: monster.position.z };
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const end = { x: monster.position.x, z: monster.position.z };
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    return { ok: true, moved: Math.sqrt(dx * dx + dz * dz) };
  });

  if (!patrolMotion.ok || patrolMotion.moved <= 0.2) {
    failures.push(`Patrol motion check failed (${JSON.stringify(patrolMotion)}).`);
  }

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 25);
  });
  await page.waitForFunction(
    () => {
      const text = document.querySelector(".debug-overlay")?.textContent ?? "";
      return text.includes("Monster: chase");
    },
    { timeout: 5_000 }
  ).catch(() => failures.push("Monster did not transition to chase in debug state."));

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 1.2);
  });
  await page.waitForSelector(".monster-chat-overlay", { timeout: 7_000 }).catch(() => {
    failures.push("Catch did not open argument overlay.");
  });

  const freezeStart = await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return null;
    return {
      player: { x: player.position.x, z: player.position.z },
      monster: { x: monster.position.x, z: monster.position.z },
    };
  });

  await delay(900);
  const freezeEnd = await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return null;
    return {
      player: { x: player.position.x, z: player.position.z },
      monster: { x: monster.position.x, z: monster.position.z },
    };
  });

  if (freezeStart && freezeEnd) {
    const deltaPlayer = Math.hypot(
      freezeEnd.player.x - freezeStart.player.x,
      freezeEnd.player.z - freezeStart.player.z
    );
    const deltaMonster = Math.hypot(
      freezeEnd.monster.x - freezeStart.monster.x,
      freezeEnd.monster.z - freezeStart.monster.z
    );
    if (deltaPlayer > 0.35 || deltaMonster > 0.35) {
      failures.push(
        `Freeze check failed during argument (player delta=${deltaPlayer.toFixed(2)}, monster delta=${deltaMonster.toFixed(2)}).`
      );
    }
  }

  const winningMessages = [
    "Please show mercy and keep me alive. I am sorry.",
    "I promise I can change and help if you let me go.",
    "My family and friends need me. I will earn a future.",
  ];

  for (const msg of winningMessages) {
    const input = page.getByPlaceholder("Type your defense...");
    await input.waitFor({ timeout: 5_000 });
    await input.fill(msg);
    await page.getByRole("button", { name: "Send" }).click();
    await delay(250);
  }

  await page.waitForSelector(".monster-chat-overlay", { state: "hidden", timeout: 7_000 }).catch(() => {
    failures.push("Argument win branch did not close overlay.");
  });

  await page.waitForFunction(
    () => {
      const text = document.querySelector(".debug-overlay")?.textContent ?? "";
      return text.includes("Phase: playing");
    },
    { timeout: 5_000 }
  ).catch(() => failures.push("Game did not return to playing after winning argument."));

  await delay(2300); // recatch grace period
  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 1.2);
  });
  await page.waitForSelector(".monster-chat-overlay", { timeout: 7_000 }).catch(() => {
    failures.push("Second catch did not open argument overlay.");
  });

  for (let i = 0; i < 3; i += 1) {
    const input = page.getByPlaceholder("Type your defense...");
    await input.waitFor({ timeout: 5_000 });
    await input.fill("no");
    await page.getByRole("button", { name: "Send" }).click();
    await delay(250);
  }

  await page.waitForSelector(".game-over-screen", { timeout: 7_000 }).catch(() => {
    failures.push("Argument loss did not show game over screen.");
  });

  const gameOverText = await page.locator(".game-over-card h2").innerText().catch(() => "");
  if (!gameOverText.includes("YOU WERE EATEN")) {
    failures.push(`Expected eaten game over text, got: "${gameOverText}"`);
  }
}

async function runFinishZonePlaytest(page, failures) {
  await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".hud", { timeout: 20_000 });
  await delay(600);

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    if (!player) return;
    player.position.z = 145;
  });

  await page.waitForSelector(".game-over-screen", { timeout: 7_000 }).catch(() => {
    failures.push("Finish-zone branch did not show game over screen.");
  });

  const gameOverText = await page.locator(".game-over-card h2").innerText().catch(() => "");
  if (!gameOverText.includes("YOU ESCAPED")) {
    failures.push(`Expected win game over text, got: "${gameOverText}"`);
  }
}

async function main() {
  const server = spawn(
    "npm",
    ["run", "dev", "--", "--host", HOST, "--port", PORT, "--strictPort"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    }
  );

  let serverLogs = "";
  server.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  const cleanupServer = async () => {
    if (server.killed || server.exitCode !== null) return;
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(3_000),
    ]);
    if (server.exitCode === null) {
      server.kill("SIGKILL");
    }
  };

  try {
    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS);
  } catch (err) {
    await cleanupServer();
    throw new Error(
      `Dev server failed to start.\n${String(err)}\n--- server logs ---\n${serverLogs}`
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    await runBranchPlaytest(page, failures);
    await runFinishZonePlaytest(page, failures);

    if (consoleErrors.length > 0) {
      failures.push(`Console errors detected (${consoleErrors.length}).`);
    }
    if (pageErrors.length > 0) {
      failures.push(`Uncaught page errors detected (${pageErrors.length}).`);
    }
  } catch (err) {
    failures.push(`Runtime flow failed before checks completed: ${String(err)}`);
  } finally {
    await browser.close();
    await cleanupServer();
  }

  if (failures.length > 0) {
    fail("Runtime smoke test failed:");
    for (const entry of failures) {
      fail(`- ${entry}`);
    }
    if (consoleErrors.length > 0) {
      console.error("[phase2-smoke] Console error samples:");
      for (const err of consoleErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    if (pageErrors.length > 0) {
      console.error("[phase2-smoke] Page error samples:");
      for (const err of pageErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    process.exit(1);
  }

  console.log("[phase2-smoke] Passed: patrol/chase, catch/freeze, argument win/loss branches, and finish-zone win.");
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
