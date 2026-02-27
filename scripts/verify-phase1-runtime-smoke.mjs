import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = process.env.PHASE1_SMOKE_PORT ?? "5180";
const BASE_URL = `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[runtime-smoke] ${message}`);
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

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  const failures = [];

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /solo|play/i }).first().click();
    await page.waitForFunction(
      () => {
        const overlay = document.querySelector(".debug-overlay");
        return (
          !!overlay &&
          typeof overlay.textContent === "string" &&
          overlay.textContent.includes("FPS:")
        );
      },
      { timeout: 20_000 }
    );
    await delay(1_000);

    const renderCheck = await page.evaluate(async () => {
      const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
      const scene = mod.EngineStore?.LastCreatedScene;
      if (!scene) return { ok: false, reason: "No active scene found." };

      const engine = scene.getEngine();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      scene.render();

      const cam = scene.activeCamera;
      const ray = scene.createPickingRay(
        w / 2,
        h / 2,
        mod.Matrix.Identity(),
        cam
      );
      const groundPick = scene.pickWithRay(ray, (m) => m.name === "ground");

      return {
        ok: true,
        activeMeshes: scene.getActiveMeshes().length,
        activeIndices: scene.getActiveIndices(),
        hitGround: groundPick?.hit === true,
      };
    });

    if (!renderCheck.ok) {
      failures.push(`Render check failed: ${renderCheck.reason}`);
    } else {
      if (renderCheck.activeMeshes <= 0 || renderCheck.activeIndices <= 0) {
        failures.push(
          `Scene render activity is invalid (activeMeshes=${renderCheck.activeMeshes}, activeIndices=${renderCheck.activeIndices}).`
        );
      }
      if (!renderCheck.hitGround) {
        failures.push("Camera center ray does not hit ground.");
      }
    }

    const parseZ = async () => {
      const text = await page.locator(".debug-overlay").innerText();
      const match = text.match(/Z:\s*(-?\d+(?:\.\d+)?)/);
      if (!match) throw new Error(`Could not parse Z value from overlay: ${text}`);
      return Number(match[1]);
    };

    await page.mouse.click(200, 200);
    const zBefore = await parseZ();
    await page.keyboard.down("w");
    await delay(2_000);
    await page.keyboard.up("w");
    const zAfter = await parseZ();
    if (!(zAfter > zBefore + 10)) {
      failures.push(`Movement check failed: Z did not increase enough (${zBefore} -> ${zAfter}).`);
    }

    const boundaryCheck = await page.evaluate(async () => {
      const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
      const scene = mod.EngineStore?.LastCreatedScene;
      const player = scene?.getMeshByName("player");
      if (!scene || !player) return { ok: false, reason: "No player mesh found." };

      const Vec3 = player.position.constructor;
      player.position.set(0, 0.9, -130);
      player.moveWithCollisions(new Vec3(-80, 0, 0));
      const leftX = player.position.x;
      player.position.set(0, 0.9, -130);
      player.moveWithCollisions(new Vec3(80, 0, 0));
      const rightX = player.position.x;

      return { ok: true, leftX, rightX };
    });

    if (!boundaryCheck.ok) {
      failures.push(`Boundary check failed: ${boundaryCheck.reason}`);
    } else {
      if (boundaryCheck.leftX < -52 || boundaryCheck.rightX > 52) {
        failures.push(
          `Boundary check failed: player escaped expected X limits (${boundaryCheck.leftX.toFixed(2)}, ${boundaryCheck.rightX.toFixed(2)}).`
        );
      }
    }

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
      console.error("[runtime-smoke] Console error samples:");
      for (const err of consoleErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    if (pageErrors.length > 0) {
      console.error("[runtime-smoke] Page error samples:");
      for (const err of pageErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    process.exit(1);
  }

  console.log("[runtime-smoke] Passed: render, camera, movement, boundary, and console checks.");
}

main().catch((err) => {
  console.error("[runtime-smoke] Fatal error:");
  console.error(err);
  process.exit(1);
});
