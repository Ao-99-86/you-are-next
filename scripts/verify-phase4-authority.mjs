import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import PartySocket from "partysocket";

const HOST = "127.0.0.1";
const PARTY_PORT = process.env.PHASE4_AUTH_PARTY_PORT ?? "2199";
const PARTY_HOST = `${HOST}:${PARTY_PORT}`;
const SERVER_TIMEOUT_MS = 30_000;

function log(msg) {
  console.log(`[phase4-authority] ${msg}`);
}

function fail(msg) {
  console.error(`[phase4-authority] ${msg}`);
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

  sendInput(input) {
    this.seq += 1;
    this.send({ type: "PLAYER_INPUT", seq: this.seq, ...input });
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

  async waitForError(code, timeoutMs = 3_000) {
    return this.waitForMessage(
      (m) => m.type === "ERROR" && m.code === code,
      timeoutMs,
      `${this.name} expected error ${code}`
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

async function drivePlayerToCatch(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = client.latestSnapshot();
    if (snapshot?.phase === "argument" && snapshot.argument.active && snapshot.argument.session) {
      return true;
    }
    if (!snapshot) {
      await delay(50);
      continue;
    }

    const self = snapshot.players.find((p) => p.id === client.selfId);
    if (!self) {
      await delay(50);
      continue;
    }

    const monster = snapshot.monster.position;
    const dx = monster.x - self.position.x;
    const dz = monster.z - self.position.z;
    const yaw = Math.atan2(dx, dz);

    client.sendInput({
      moveH: 0,
      moveV: 1,
      yaw,
      pitch: 0,
      dtMs: 50,
    });
    await delay(50);
  }
  return false;
}

async function runAuthorityChecks() {
  const failures = [];

  // Scenario 1: lobby rules, movement clamp, deterministic argument/chat path
  {
    const roomId = `auth_${Date.now()}`;
    const a = new RoomClient("A", roomId);
    const b = new RoomClient("B", roomId);

    try {
      log("Scenario 1: lobby rules, movement clamp, and argument/chat permissions");
      await a.connectAndJoin();
      await b.connectAndJoin();

      await a.waitForSnapshot((s) => s.players.length === 2, 6_000, "2 players in lobby");
      const lobbySnap = a.latestSnapshot();
      if (lobbySnap?.hostId !== a.selfId) {
        failures.push("Expected first joiner to be hostId in lobby snapshot.");
      }

      b.send({ type: "REQUEST_START" });
      try {
        await b.waitForError("NOT_HOST", 3_000);
      } catch {
        failures.push("Non-host REQUEST_START did not return NOT_HOST.");
      }

      a.send({ type: "REQUEST_START" });
      try {
        await a.waitForError("NOT_READY", 3_000);
      } catch {
        failures.push("Host REQUEST_START before ready did not return NOT_READY.");
      }

      a.send({ type: "SET_READY", ready: true });
      await delay(200);
      a.send({ type: "REQUEST_START" });
      try {
        await a.waitForError("NOT_READY", 3_000);
      } catch {
        failures.push("Host REQUEST_START with one unready player did not return NOT_READY.");
      }

      b.send({ type: "SET_READY", ready: true });
      await delay(200);
      a.send({ type: "REQUEST_START" });
      await a.waitForSnapshot((s) => s.phase === "playing", 5_000, "phase playing");

      for (let i = 0; i < 120; i += 1) {
        a.sendInput({ moveH: 1, moveV: 0, yaw: 0, pitch: 0, dtMs: 50 });
        await delay(20);
      }
      await delay(300);
      const postMove = a.latestSnapshot();
      const self = postMove?.players.find((p) => p.id === a.selfId);
      if (!self) {
        failures.push("Could not locate self player in snapshot after movement.");
      } else if (self.position.x > 49.05 || self.position.x < -49.05) {
        failures.push(`Boundary clamp failed; player x=${self.position.x.toFixed(2)} out of bounds.`);
      }

      const caught = await drivePlayerToCatch(a, 30_000);
      if (!caught) {
        failures.push("Deterministic catch drive did not reach argument phase.");
      } else {
        const argSnap = a.latestSnapshot();
        const sessionId = argSnap?.argument?.session?.id;
        const caughtId = argSnap?.argument?.caughtPlayerId;

        if (!sessionId || !caughtId) {
          failures.push("Argument session missing required session/caught identifiers.");
        } else {
          const caughtClient = caughtId === a.selfId ? a : b;
          const otherClient = caughtClient === a ? b : a;

          otherClient.send({ type: "CHAT_SUBMIT", sessionId, message: "not allowed" });
          try {
            await otherClient.waitForError("NOT_CAUGHT", 3_000);
          } catch {
            failures.push("Non-caught CHAT_SUBMIT did not return NOT_CAUGHT.");
          }

          const beforeRound = a.latestSnapshot()?.argument?.session?.currentRound ?? -1;
          caughtClient.send({
            type: "CHAT_SUBMIT",
            sessionId: `${sessionId}_stale`,
            message: "stale",
          });
          await delay(400);
          const afterStaleRound = a.latestSnapshot()?.argument?.session?.currentRound ?? -1;
          if (beforeRound !== -1 && afterStaleRound !== beforeRound) {
            failures.push("Stale CHAT_SUBMIT unexpectedly advanced argument round.");
          }

          caughtClient.send({ type: "CHAT_SUBMIT", sessionId, message: "I can survive this." });
          await delay(600);
          const afterValid = a.latestSnapshot();
          const validRound = afterValid?.argument?.session?.currentRound ?? -1;
          const stillArgument = afterValid?.phase === "argument";
          if (stillArgument && validRound <= beforeRound) {
            failures.push("Caught player CHAT_SUBMIT did not advance argument progression.");
          }
        }
      }
    } catch (err) {
      failures.push(`Scenario 1 failed unexpectedly: ${String(err)}`);
    } finally {
      a.close();
      b.close();
    }
  }

  // Scenario 2: room capacity cap
  {
    const roomId = `cap_${Date.now()}`;
    const clients = [
      new RoomClient("P1", roomId),
      new RoomClient("P2", roomId),
      new RoomClient("P3", roomId),
      new RoomClient("P4", roomId),
      new RoomClient("P5", roomId),
    ];

    try {
      log("Scenario 2: room capacity hard-cap");
      for (let i = 0; i < 4; i += 1) {
        await clients[i].connectAndJoin();
      }
      await clients[0].waitForSnapshot((s) => s.players.filter((p) => p.connected).length === 4, 6_000, "4-player lobby");

      await clients[4].connectAndJoin({ expectWelcome: false });
      try {
        await clients[4].waitForError("ROOM_FULL", 3_000);
      } catch {
        failures.push("5th player join did not return ROOM_FULL.");
      }
    } catch (err) {
      failures.push(`Scenario 2 failed unexpectedly: ${String(err)}`);
    } finally {
      for (const c of clients) c.close();
    }
  }

  // Scenario 3: host promotion and start after disconnect
  {
    const roomId = `host_${Date.now()}`;
    const h = new RoomClient("Host", roomId);
    const p2 = new RoomClient("P2", roomId);
    const p3 = new RoomClient("P3", roomId);

    try {
      log("Scenario 3: host promotion and start after host disconnect");
      await h.connectAndJoin();
      await p2.connectAndJoin();
      await p3.connectAndJoin();
      await h.waitForSnapshot((s) => s.players.length === 3, 6_000, "3-player lobby");

      p2.send({ type: "SET_READY", ready: true });
      p3.send({ type: "SET_READY", ready: true });
      await delay(250);

      h.close();

      await p2.waitForSnapshot(
        (s) => s.players.some((p) => p.id === h.selfId && !p.connected) && s.hostId === p2.selfId,
        6_000,
        "host handoff snapshot"
      );

      p2.send({ type: "SET_READY", ready: true });
      await delay(200);
      p2.send({ type: "REQUEST_START" });
      await p2.waitForSnapshot((s) => s.phase === "playing", 4_000, "promoted host start");
    } catch (err) {
      failures.push(`Scenario 3 failed unexpectedly: ${String(err)}`);
    } finally {
      p2.close();
      p3.close();
    }
  }

  // Scenario 4: reconnect restoration continuity
  {
    const roomId = `recon_${Date.now()}`;
    const a = new RoomClient("A", roomId);
    const b = new RoomClient("B", roomId);

    try {
      log("Scenario 4: reconnect continuity with stable client identity");
      await a.connectAndJoin();
      await b.connectAndJoin();
      await a.waitForSnapshot((s) => s.players.length === 2, 6_000, "2 players before reconnect");

      const oldBId = b.selfId;
      const oldBClientId = b.clientId;

      b.close();
      await a.waitForSnapshot(
        (s) => s.players.some((p) => p.id === oldBId && !p.connected),
        6_000,
        "B disconnected flag"
      );

      const bRe = new RoomClient("B", roomId, oldBClientId);
      await bRe.connectAndJoin();
      await a.waitForSnapshot(
        (s) => s.players.some((p) => p.id === oldBId && p.connected),
        6_000,
        "B reconnected with same player id"
      );

      const snap = a.latestSnapshot();
      const bEntries = snap.players.filter((p) => p.id === oldBId);
      if (bEntries.length !== 1) {
        failures.push("Reconnect continuity failed: duplicate player entries found for same player id.");
      }
      if ((snap.players.length ?? 0) !== 2) {
        failures.push(`Reconnect continuity failed: expected 2 players after reconnect, got ${snap.players.length}.`);
      }

      bRe.close();
    } catch (err) {
      failures.push(`Scenario 4 failed unexpectedly: ${String(err)}`);
    } finally {
      a.close();
      b.close();
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
    failures = await runAuthorityChecks();
  } finally {
    await killProcess(party.child);
  }

  if (failures.length > 0) {
    fail("Authority verification failed:");
    for (const f of failures) {
      fail(`- ${f}`);
    }
    process.exit(1);
  }

  log("Passed: host/ready rules, room cap, disconnect snapshots, host handoff, reconnect restoration, and argument/chat permissions.");
  process.exit(0);
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
