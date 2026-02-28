import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import PartySocket from "partysocket";

const HOST = "127.0.0.1";
const PARTY_PORT = process.env.PHASE6_PARTY_PORT ?? "2299";
const PARTY_HOST = `${HOST}:${PARTY_PORT}`;
const SERVER_TIMEOUT_MS = 30_000;
const TEST_SECRET = "test-invite-secret-42";

function log(msg) {
  console.log(`[phase6-invite] ${msg}`);
}

function fail(msg) {
  console.error(`[phase6-invite] FAIL: ${msg}`);
  process.exitCode = 1;
}

function spawnProcess(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
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

async function waitForServer(host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const probe = new PartySocket({ host, room: `probe_${Date.now()}` });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("probe timeout")), 2_000);
        probe.addEventListener("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        probe.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("probe socket error"));
        });
      });
      probe.close();
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Timed out waiting for PartyKit at ${host}`);
}

function connectSocket(roomId) {
  return new PartySocket({ host: PARTY_HOST, room: roomId });
}

function waitForMessage(socket, predicate, timeoutMs = 5_000, label = "message") {
  const messages = [];
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${label}. Got: ${JSON.stringify(messages)}`));
    }, timeoutMs);

    socket.addEventListener("message", (evt) => {
      let msg;
      try {
        msg = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      messages.push(msg);
      if (predicate(msg)) {
        clearTimeout(timeout);
        resolve(msg);
      }
    });
  });
}

async function runInviteChecks() {
  const failures = [];

  // Scenario 1: Connection without invite code → rejected with INVITE_INVALID
  {
    const roomId = `inv_no_code_${Date.now()}`;
    const socket = connectSocket(roomId);
    try {
      log("Scenario 1: JOIN_ROOM without invite code → INVITE_INVALID");
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("open timeout")), 5_000);
        socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); });
        socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("socket error")); });
      });

      const errorPromise = waitForMessage(
        socket,
        (m) => m.type === "ERROR" && m.code === "INVITE_INVALID",
        5_000,
        "INVITE_INVALID error"
      );

      socket.send(JSON.stringify({
        type: "JOIN_ROOM",
        roomId,
        name: "NoCode",
        clientId: `client_nocode_${Date.now()}`,
      }));

      await errorPromise;
      log("  PASS: Missing invite code rejected");
    } catch (err) {
      failures.push(`Scenario 1 failed: ${String(err)}`);
    } finally {
      socket.close();
    }
  }

  // Scenario 2: Connection with wrong invite code → rejected
  {
    const roomId = `inv_wrong_${Date.now()}`;
    const socket = connectSocket(roomId);
    try {
      log("Scenario 2: JOIN_ROOM with wrong invite code → INVITE_INVALID");
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("open timeout")), 5_000);
        socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); });
        socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("socket error")); });
      });

      const errorPromise = waitForMessage(
        socket,
        (m) => m.type === "ERROR" && m.code === "INVITE_INVALID",
        5_000,
        "INVITE_INVALID error"
      );

      socket.send(JSON.stringify({
        type: "JOIN_ROOM",
        roomId,
        name: "WrongCode",
        clientId: `client_wrong_${Date.now()}`,
        inviteCode: "wrong-code-123",
      }));

      await errorPromise;
      log("  PASS: Wrong invite code rejected");
    } catch (err) {
      failures.push(`Scenario 2 failed: ${String(err)}`);
    } finally {
      socket.close();
    }
  }

  // Scenario 3: Connection with correct invite code → WELCOME received
  {
    const roomId = `inv_ok_${Date.now()}`;
    const socket = connectSocket(roomId);
    try {
      log("Scenario 3: JOIN_ROOM with correct invite code → WELCOME");
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("open timeout")), 5_000);
        socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); });
        socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("socket error")); });
      });

      const welcomePromise = waitForMessage(
        socket,
        (m) => m.type === "WELCOME",
        5_000,
        "WELCOME"
      );

      socket.send(JSON.stringify({
        type: "JOIN_ROOM",
        roomId,
        name: "GoodCode",
        clientId: `client_good_${Date.now()}`,
        inviteCode: TEST_SECRET,
      }));

      await welcomePromise;
      log("  PASS: Correct invite code accepted");
    } catch (err) {
      failures.push(`Scenario 3 failed: ${String(err)}`);
    } finally {
      socket.close();
    }
  }

  return failures;
}

async function main() {
  log("Starting PartyKit dev server with INVITE_SECRET...");
  const party = spawnProcess("npx", [
    "partykit", "dev",
    "--port", PARTY_PORT,
    "--var", `INVITE_SECRET=${TEST_SECRET}`,
  ]);

  try {
    await waitForServer(PARTY_HOST, SERVER_TIMEOUT_MS);
    log("PartyKit dev server ready.");
  } catch (err) {
    await killProcess(party.child);
    throw new Error(`Party server failed to start. ${String(err)}\n--- party logs ---\n${party.getLogs()}`);
  }

  let failures = [];
  try {
    failures = await runInviteChecks();
  } finally {
    await killProcess(party.child);
  }

  if (failures.length > 0) {
    fail("Invite verification failed:");
    for (const f of failures) {
      fail(`  - ${f}`);
    }
    process.exit(1);
  }

  log("All invite gating checks passed.");
  process.exit(0);
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
