import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = process.env.PHASE3_SMOKE_PORT ?? "5183";
const BASE_URL = `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`[phase3-smoke] ${message}`);
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

async function getAudioSnapshot(page) {
  return page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const phaseText = document.querySelector(".debug-overlay")?.textContent ?? "";

    const sounds = (scene?.mainSoundTrack?.soundCollection ?? []).map((sound) => ({
      name: sound.name,
      isReady: typeof sound.isReady === "function" ? sound.isReady() : false,
      isPlaying: !!sound.isPlaying,
      volume: typeof sound.getVolume === "function" ? sound.getVolume() : null,
    }));

    const byName = Object.fromEntries(sounds.map((sound) => [sound.name, sound]));
    const audioEngine = mod.Engine?.audioEngine;
    return {
      hasScene: !!scene,
      phaseText,
      sounds,
      byName,
      audioEngine: audioEngine
        ? {
            exists: true,
            canUseWebAudio: audioEngine.canUseWebAudio ?? null,
            unlocked: !!audioEngine.unlocked,
            contextState: audioEngine.audioContext?.state ?? null,
          }
        : { exists: false, canUseWebAudio: null, unlocked: false, contextState: null },
    };
  });
}

async function waitForCondition(getValue, predicate, timeoutMs, label) {
  const start = Date.now();
  let lastValue = null;
  while (Date.now() - start < timeoutMs) {
    lastValue = await getValue();
    if (predicate(lastValue)) {
      return { ok: true, value: lastValue };
    }
    await delay(150);
  }
  return { ok: false, value: lastValue, label };
}

async function sampleSoundActivity(page, soundName, durationMs, intervalMs) {
  return page.evaluate(
    async ({ soundNameArg, durationArg, intervalArg }) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
      const scene = mod.EngineStore?.LastCreatedScene;
      if (!scene) return { ok: false, reason: "scene missing" };

      const sound = (scene.mainSoundTrack?.soundCollection ?? []).find((s) => s.name === soundNameArg);
      if (!sound) return { ok: false, reason: `sound '${soundNameArg}' missing` };

      let playingSamples = 0;
      let totalSamples = 0;
      const start = performance.now();
      while (performance.now() - start < durationArg) {
        totalSamples += 1;
        if (sound.isPlaying) {
          playingSamples += 1;
        }
        await sleep(intervalArg);
      }

      return { ok: true, soundName: soundNameArg, playingSamples, totalSamples };
    },
    { soundNameArg: soundName, durationArg: durationMs, intervalArg: intervalMs }
  );
}

async function sampleCatchAudioAndShake(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    if (!scene) return { ok: false, reason: "scene missing" };

    const catchSound = (scene.mainSoundTrack?.soundCollection ?? []).find((s) => s.name === "catchSting");
    if (!catchSound) return { ok: false, reason: "catchSting missing" };

    const camera = scene.activeCamera;
    if (!camera) return { ok: false, reason: "activeCamera missing" };

    const xs = [];
    const ys = [];
    let playingSamples = 0;
    let totalSamples = 0;
    const start = performance.now();
    while (performance.now() - start < 900) {
      totalSamples += 1;
      xs.push(camera.position.x);
      ys.push(camera.position.y);
      if (catchSound.isPlaying) {
        playingSamples += 1;
      }
      await sleep(25);
    }

    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    return { ok: true, playingSamples, totalSamples, xRange, yRange };
  });
}

async function runPhase3Playtest(page, failures) {
  const expectedSounds = ["ambient", "heartbeat", "footstep", "catchSting"];

  await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".debug-overlay", { timeout: 20_000 });
  await delay(700);

  // Gesture to satisfy browser autoplay policies and pointer-lock/input routing.
  await page.mouse.click(220, 220);
  await delay(300);

  const soundsPresent = await waitForCondition(
    () => getAudioSnapshot(page),
    (value) => expectedSounds.every((name) => !!value.byName[name]),
    12_000,
    "Expected Phase 3 sounds were not all present."
  );
  if (!soundsPresent.ok) {
    failures.push(`${soundsPresent.label} Snapshot: ${JSON.stringify(soundsPresent.value)}`);
    return;
  }

  const soundsReady = await waitForCondition(
    () => getAudioSnapshot(page),
    (value) => expectedSounds.every((name) => value.byName[name]?.isReady === true),
    12_000,
    "Expected Phase 3 sounds did not become ready."
  );
  if (!soundsReady.ok) {
    failures.push(`${soundsReady.label} Snapshot: ${JSON.stringify(soundsReady.value)}`);
  }

  const audioUnlocked = await waitForCondition(
    () => getAudioSnapshot(page),
    (value) => value.audioEngine.exists && value.audioEngine.unlocked,
    8_000,
    "Babylon audio engine was not unlocked after user interaction."
  );
  if (!audioUnlocked.ok) {
    failures.push(`${audioUnlocked.label} Snapshot: ${JSON.stringify(audioUnlocked.value)}`);
  }

  const ambientPlaying = await waitForCondition(
    () => getAudioSnapshot(page),
    (value) => value.byName.ambient?.isPlaying === true,
    10_000,
    "Ambient loop never entered playing state."
  );
  if (!ambientPlaying.ok) {
    failures.push(`${ambientPlaying.label} Snapshot: ${JSON.stringify(ambientPlaying.value)}`);
  }

  await page.mouse.click(220, 220);
  const footstepProbePromise = sampleSoundActivity(page, "footstep", 1_500, 35);
  await page.keyboard.down("w");
  await delay(1_100);
  await page.keyboard.up("w");
  const footstepProbe = await footstepProbePromise;
  if (!footstepProbe.ok) {
    failures.push(`Footstep probe failed: ${footstepProbe.reason}`);
  } else if (footstepProbe.playingSamples <= 0) {
    failures.push(`Footstep sound never played while moving (${JSON.stringify(footstepProbe)}).`);
  }

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 8);
  });
  await delay(200);
  const heartbeatProbe = await sampleSoundActivity(page, "heartbeat", 2_800, 35);
  if (!heartbeatProbe.ok) {
    failures.push(`Heartbeat probe failed: ${heartbeatProbe.reason}`);
  } else if (heartbeatProbe.playingSamples <= 0) {
    failures.push(`Heartbeat sound never played in proximity scenario (${JSON.stringify(heartbeatProbe)}).`);
  }

  // Use a fresh play session to ensure catch-shake is sampled from trigger start.
  await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".debug-overlay", { timeout: 20_000 });
  await delay(600);
  await page.mouse.click(220, 220);
  await delay(300);

  await page.evaluate(async () => {
    const mod = await import("/node_modules/.vite/deps/@babylonjs_core.js");
    const scene = mod.EngineStore?.LastCreatedScene;
    const player = scene?.getMeshByName("player");
    const monster = scene?.getMeshByName("monsterBody");
    if (!player || !monster) return;
    player.position.set(monster.position.x, player.position.y, monster.position.z - 1.2);
  });
  await page.waitForFunction(
    () => {
      const text = document.querySelector(".debug-overlay")?.textContent ?? "";
      return text.includes("Phase: argument");
    },
    { timeout: 7_000 }
  ).catch(() => {
    failures.push("Catch scenario did not transition to argument phase.");
  });
  const catchProbe = await sampleCatchAudioAndShake(page);
  if (!catchProbe.ok) {
    failures.push(`Catch probe failed: ${catchProbe.reason}`);
  } else {
    if (catchProbe.playingSamples <= 0) {
      failures.push(`Catch sting sound never entered playing state (${JSON.stringify(catchProbe)}).`);
    }
    if (catchProbe.xRange <= 0.01 || catchProbe.yRange <= 0.01) {
      failures.push(
        `Catch shake was not observable (xRange=${catchProbe.xRange.toFixed(4)}, yRange=${catchProbe.yRange.toFixed(4)}).`
      );
    }
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
  const autoplayWarnings = [];
  const failures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      return;
    }
    if (msg.type() === "warning") {
      const text = msg.text();
      if (/AudioContext was not allowed to start/i.test(text)) {
        autoplayWarnings.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    await runPhase3Playtest(page, failures);

    if (autoplayWarnings.length > 0) {
      failures.push(`Autoplay-related audio warnings detected (${autoplayWarnings.length}).`);
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
    if (autoplayWarnings.length > 0) {
      console.error("[phase3-smoke] Autoplay warning samples:");
      for (const warn of autoplayWarnings.slice(0, 5)) console.error(`  ${warn}`);
    }
    if (consoleErrors.length > 0) {
      console.error("[phase3-smoke] Console error samples:");
      for (const err of consoleErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    if (pageErrors.length > 0) {
      console.error("[phase3-smoke] Page error samples:");
      for (const err of pageErrors.slice(0, 5)) console.error(`  ${err}`);
    }
    process.exit(1);
  }

  console.log("[phase3-smoke] Passed: Babylon Sound readiness/unlock, ambient+heartbeat+footstep+catch-sting activity, catch-shake, and runtime console checks.");
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
