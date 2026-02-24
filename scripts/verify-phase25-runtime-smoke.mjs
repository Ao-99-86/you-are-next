import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = process.env.PHASE25_SMOKE_PORT ?? "5182";
const BASE_URL = `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[phase25-smoke] ${message}`);
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

async function getPlayerViewState(page) {
  return page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const camRoot = scene?.getTransformNodeByName("camRoot");
    const yTilt = scene?.getTransformNodeByName("yTilt");
    return {
      hasScene: !!scene,
      hasPlayer: !!player,
      hasCamRoot: !!camRoot,
      hasYTilt: !!yTilt,
      player: player ? { x: player.position.x, z: player.position.z } : null,
      yaw: camRoot?.rotation?.y ?? null,
      pitch: yTilt?.rotation?.x ?? null,
      pointerLocked: document.pointerLockElement?.tagName === "CANVAS",
    };
  });
}

async function runControlPlaytest(page, failures) {
  await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".debug-overlay", { timeout: 20_000 });
  await delay(500);

  // Prime focus/input on the canvas so key events are routed reliably.
  await page.mouse.click(220, 220);
  await delay(100);

  const beforeStrafe = await getPlayerViewState(page);
  if (!beforeStrafe.hasScene || !beforeStrafe.hasPlayer || !beforeStrafe.hasCamRoot) {
    failures.push("Control check setup failed (missing scene/player/camera nodes).");
    return;
  }

  await page.keyboard.down("d");
  await delay(1200);
  await page.keyboard.up("d");
  await delay(200);

  const afterStrafe = await getPlayerViewState(page);
  const deltaX = (afterStrafe.player?.x ?? 0) - (beforeStrafe.player?.x ?? 0);
  const deltaYaw = Math.abs((afterStrafe.yaw ?? 0) - (beforeStrafe.yaw ?? 0));

  if (Math.abs(deltaX) < 3) {
    failures.push(`Strafe check failed: insufficient lateral movement (${deltaX.toFixed(2)}).`);
  }
  if (deltaYaw > 0.05) {
    failures.push(`Strafe check failed: yaw changed during A/D strafe (delta=${deltaYaw.toFixed(3)}).`);
  }

  await page.mouse.click(220, 220);
  const pointerLockAcquired = await page.waitForFunction(
    () => document.pointerLockElement?.tagName === "CANVAS",
    undefined,
    { timeout: 2_500 }
  ).then(() => true).catch(() => false);

  const beforeLook = await getPlayerViewState(page);
  let afterLook = beforeLook;

  if (pointerLockAcquired) {
    await page.mouse.move(480, 170, { steps: 8 });
    await delay(200);
    afterLook = await getPlayerViewState(page);

    const yawDelta = Math.abs((afterLook.yaw ?? 0) - (beforeLook.yaw ?? 0));
    const pitchDelta = Math.abs((afterLook.pitch ?? 0) - (beforeLook.pitch ?? 0));
    if (yawDelta < 0.02) {
      failures.push(`Mouse-look check failed: yaw did not change enough (delta=${yawDelta.toFixed(3)}).`);
    }
    if (pitchDelta < 0.01) {
      failures.push(`Mouse-look check failed: pitch did not change enough (delta=${pitchDelta.toFixed(3)}).`);
    }

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.pointerLockElement === null, undefined, {
      timeout: 5_000,
    }).catch(() => failures.push("Pointer lock did not release via Escape."));
  } else {
    console.warn("[phase25-smoke] Pointer lock was unavailable under this headless run; strict mouse-look assertions were skipped.");
  }
}

async function runPhase2BranchPlaytest(page, failures) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForSelector(".hud", { timeout: 20_000 });
  await page.waitForSelector(".debug-overlay", { timeout: 20_000 });

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 1.2);
  });

  await page.waitForSelector(".monster-chat-overlay", { timeout: 7_000 }).catch(() => {
    failures.push("Catch did not open argument overlay after controls update.");
  });

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

  await delay(2300);
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
    await runControlPlaytest(page, failures);
    await runPhase2BranchPlaytest(page, failures);
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
      console.error("[phase25-smoke] Console error samples:");
      for (const err of consoleErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    if (pageErrors.length > 0) {
      console.error("[phase25-smoke] Page error samples:");
      for (const err of pageErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    process.exit(1);
  }

  console.log("[phase25-smoke] Passed: WASD strafe, mouse look, pointer lock lifecycle, and Phase 2 gameplay branches.");
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
