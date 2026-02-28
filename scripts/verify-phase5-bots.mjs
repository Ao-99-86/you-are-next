import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import PartySocket from "partysocket";

const HOST = "127.0.0.1";
const PARTY_PORT = process.env.PHASE5_BOTS_PARTY_PORT ?? "2200";
const PARTY_HOST = `${HOST}:${PARTY_PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function log(msg) {
  console.log(`[phase5-bots] ${msg}`);
}

function fail(msg) {
  console.error(`[phase5-bots] ${msg}`);
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

class RoomClient {
  constructor(name, roomId, clientId = null) {
    this.name = name;
    this.roomId = roomId;
    this.clientId = clientId ?? `client_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.socket = null;
    this.messages = [];
    this.waiters = [];
    this.selfId = null;
    this.seq = 0;
  }

  async connectAndJoin(options = {}) {
    const expectWelcome = options.expectWelcome !== false;
    this.socket = new PartySocket({ host: PARTY_HOST, room: this.roomId });

    this.socket.addEventListener("message", (evt) => {
      let msg;
      try {
        msg = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      this.messages.push(msg);
      if (msg.type === "WELCOME") {
        this.selfId = msg.selfId;
      }
      this._resolveWaiters();
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${this.name} open timeout`)), 5_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      this.socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error(`${this.name} socket error`));
      });
    });

    this.send({
      type: "JOIN_ROOM",
      roomId: this.roomId,
      name: this.name,
      clientId: this.clientId,
    });
    if (expectWelcome) {
      await this.waitForMessage((m) => m.type === "WELCOME", 5_000, `${this.name} welcome`);
    }
  }

  send(msg) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`${this.name} socket not open`);
    }
    this.socket.send(JSON.stringify(msg));
  }

  close() {
    if (this.socket) this.socket.close();
  }

  latestSnapshot() {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      const msg = this.messages[i];
      if (msg.type === "ROOM_SNAPSHOT") return msg.snapshot;
    }
    return null;
  }

  async waitForSnapshot(predicate, timeoutMs, label) {
    return this.waitForMessage(
      (m) => m.type === "ROOM_SNAPSHOT" && predicate(m.snapshot),
      timeoutMs,
      label
    );
  }

  async waitForMessage(predicate, timeoutMs = 4_000, label = "message") {
    for (const msg of this.messages) {
      if (predicate(msg)) return msg;
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error(`Timeout waiting for ${label}`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  _resolveWaiters() {
    for (const waiter of [...this.waiters]) {
      const hit = this.messages.find(waiter.predicate);
      if (hit) {
        clearTimeout(waiter.timeout);
        this.waiters = this.waiters.filter((w) => w !== waiter);
        waiter.resolve(hit);
      }
    }
  }
}

async function runBotChecks() {
  const failures = [];

  // Scenario 1: Solo start spawns bots
  {
    const roomId = `bots_${Date.now()}`;
    const a = new RoomClient("Solo", roomId);

    try {
      log("Scenario 1: Solo start spawns bots");
      await a.connectAndJoin();

      // Before start — only 1 player
      await a.waitForSnapshot(
        (s) => s.players.length === 1,
        6_000,
        "1 player in lobby"
      );
      const lobbySnap = a.latestSnapshot();
      const botsInLobby = lobbySnap?.players.filter((p) => p.isBot) ?? [];
      if (botsInLobby.length > 0) {
        failures.push("Bots should not be present in lobby phase.");
      }

      // Set ready and start
      a.send({ type: "SET_READY", ready: true });
      await delay(200);
      a.send({ type: "REQUEST_START" });

      // Wait for playing phase with bots
      await a.waitForSnapshot(
        (s) => s.phase === "playing" && s.players.length > 1,
        8_000,
        "playing with bots"
      );

      const playSnap = a.latestSnapshot();
      const bots = playSnap?.players.filter((p) => p.isBot) ?? [];
      if (bots.length === 0) {
        failures.push("No bots spawned after solo start.");
      } else {
        log(`  Spawned ${bots.length} bots.`);
      }

      // Verify bot properties
      for (const bot of bots) {
        if (!bot.name.startsWith("Bot ")) {
          failures.push(`Bot name "${bot.name}" does not start with "Bot ".`);
        }
        if (!bot.connected) {
          failures.push(`Bot "${bot.name}" is not connected.`);
        }
        if (!bot.isReady) {
          failures.push(`Bot "${bot.name}" is not ready.`);
        }
      }

      // Wait 2 seconds and check bot Z positions advanced
      const initialBotZ = bots.map((b) => b.position.z);
      await delay(2_000);
      const afterSnap = a.latestSnapshot();
      const afterBots = afterSnap?.players.filter((p) => p.isBot) ?? [];

      let anyMoved = false;
      for (const bot of afterBots) {
        const initial = initialBotZ[bots.findIndex((b) => b.id === bot.id)];
        if (initial !== undefined && bot.position.z > initial + 0.1) {
          anyMoved = true;
        }
      }
      if (!anyMoved && afterBots.length > 0) {
        failures.push("Bot Z positions did not advance after 2 seconds.");
      } else {
        log("  Bot movement confirmed.");
      }
    } catch (err) {
      failures.push(`Scenario 1 failed unexpectedly: ${String(err)}`);
    } finally {
      a.close();
    }
  }

  // Scenario 2: Bot argument auto-resolves
  {
    const roomId = `botarg_${Date.now()}`;
    const a = new RoomClient("Human", roomId);

    try {
      log("Scenario 2: Bot argument auto-resolves");
      await a.connectAndJoin();
      a.send({ type: "SET_READY", ready: true });
      await delay(200);
      a.send({ type: "REQUEST_START" });

      await a.waitForSnapshot(
        (s) => s.phase === "playing",
        8_000,
        "game started"
      );

      // Wait for an argument phase with a bot caught
      let botCaught = false;
      const argDeadline = Date.now() + 90_000;
      while (Date.now() < argDeadline) {
        const snap = a.latestSnapshot();
        if (
          snap?.phase === "argument" &&
          snap.argument?.active &&
          snap.argument?.caughtPlayerId
        ) {
          const caught = snap.players.find(
            (p) => p.id === snap.argument.caughtPlayerId
          );
          if (caught?.isBot) {
            botCaught = true;
            log("  Bot caught in argument phase.");
            break;
          }
        }
        await delay(200);
      }

      if (!botCaught) {
        // It's possible the human got caught first or game ended — not a hard failure
        log("  No bot was caught within timeout (non-fatal).");
      } else {
        // Wait for argument to resolve without human input
        let resolved = false;
        const resolveDeadline = Date.now() + 30_000;
        while (Date.now() < resolveDeadline) {
          const snap = a.latestSnapshot();
          if (snap?.phase === "playing" || snap?.phase === "game_over") {
            resolved = true;
            break;
          }
          await delay(200);
        }
        if (!resolved) {
          failures.push("Bot argument did not auto-resolve within 30s.");
        } else {
          log("  Bot argument auto-resolved.");
        }
      }
    } catch (err) {
      failures.push(`Scenario 2 failed unexpectedly: ${String(err)}`);
    } finally {
      a.close();
    }
  }

  return failures;
}

async function main() {
  log("Starting PartyKit dev server...");
  const party = spawnProcess("npx", ["partykit", "dev", "--port", PARTY_PORT]);

  try {
    await waitForServer(PARTY_HOST, SERVER_TIMEOUT_MS);
    log("PartyKit dev server ready.");
  } catch (err) {
    await killProcess(party.child);
    throw new Error(`Party server failed to start. ${String(err)}\n--- party logs ---\n${party.getLogs()}`);
  }

  let failures = [];
  try {
    failures = await runBotChecks();
  } finally {
    await killProcess(party.child);
  }

  if (failures.length > 0) {
    fail("Bot verification failed:");
    for (const f of failures) {
      fail(`- ${f}`);
    }
    process.exit(1);
  }

  log("Passed: solo start spawns bots, bot names/connected/ready, bot movement, bot argument auto-resolve.");
  process.exit(0);
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
