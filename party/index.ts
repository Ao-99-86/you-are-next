import type { Party } from "partykit/server";
import {
  BOT_COUNT,
  BOT_FILL_TO_MAX,
  CATCH_RADIUS,
  FINISH_Z,
  MAP_DEPTH,
  MAP_WIDTH,
  MONSTER_DETECT_RANGE,
  MONSTER_SPEED,
  PLAYER_SPEED,
  RECATCH_GRACE_MS,
  START_Z,
} from "../game/constants";
import { gameUpdater, createInitialGameLogicState } from "../game/logic";
import {
  GameResult,
  type ClientMessage,
  type GameLogicState,
  type NetworkArgumentState,
  type NetworkPlayerState,
  type PlayerLifeState,
  type RoomEvent,
  type RoomPhase,
  type RoomSnapshot,
  type ServerMessage,
  type Vec3,
} from "../game/types";
import {
  type BotRecord,
  createBot,
  tickBotMovement,
  resolveBotChatMessage,
} from "./aiPlayers";
import { generateBotChatMessage, generateMonsterReply } from "./azureChat";

const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;
const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 1;
const ASSIST_COOLDOWN_MS = 5000;
const ASSIST_EFFECT_MS = 2000;

function planarDist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

interface PlayerRecord {
  id: string; // Stable player id for room lifetime
  clientId: string; // Stable client identity from browser/session
  connId: string | null;
  name: string;
  isBot: boolean;
  lifeState: PlayerLifeState;
  position: Vec3;
  yaw: number;
  pitch: number;
  connected: boolean;
  isReady: boolean;
  lastUpdateMs: number;
  recatchGraceUntilMs: number;
}

interface MonsterRecord {
  position: Vec3;
  yaw: number;
  state: "patrol" | "chase";
  targetPlayerId: string | null;
  patrolIndex: number;
  patrolPoints: Vec3[];
}

function createPatrolPoints(): Vec3[] {
  const baseZ = START_Z + 55;
  return [
    { x: -8, y: 1.6, z: baseZ - 10 },
    { x: 8, y: 1.6, z: baseZ - 2 },
    { x: 10, y: 1.6, z: baseZ + 8 },
    { x: -10, y: 1.6, z: baseZ + 14 },
  ];
}

interface AssistEntry {
  targetPlayerId: string;
  effectUntilMs: number;
}

export default class GameServer implements Party.Server {
  private _phase: RoomPhase = "lobby";
  private _players: Map<string, PlayerRecord> = new Map(); // playerId -> player
  private _connToPlayerId: Map<string, string> = new Map(); // conn.id -> playerId
  private _nextPlayerNumber = 1;
  private _monster: MonsterRecord;
  private _argumentState: NetworkArgumentState = {
    active: false,
    caughtPlayerId: null,
    session: null,
    activeTyperId: null,
  };
  private _logicState: GameLogicState = createInitialGameLogicState();
  private _result: GameResult | null = null;
  private _tickInterval: ReturnType<typeof setInterval> | null = null;
  private _hostId: string | null = null;
  private _assists: Map<string, AssistEntry> = new Map(); // eatenPlayerId -> assist
  private _assistCooldowns: Map<string, number> = new Map(); // eatenPlayerId -> ms

  constructor(readonly room: Party.Room) {
    this._monster = {
      position: { x: 0, y: 1.6, z: START_Z + 55 },
      yaw: 0,
      state: "patrol",
      targetPlayerId: null,
      patrolIndex: 0,
      patrolPoints: createPatrolPoints(),
    };
  }

  onConnect(conn: Party.Connection): void {
    console.log(`[party] ${conn.id} connected to room ${this.room.id}`);
    // Wait for JOIN_ROOM before sending WELCOME so selfId is stable player id.
  }

  onMessage(message: string, sender: Party.Connection): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      this._sendError(sender, "PARSE_ERROR", "Invalid JSON");
      return;
    }

    switch (msg.type) {
      case "JOIN_ROOM":
        this._handleJoinRoom(sender, msg.name, msg.clientId, msg.inviteCode);
        break;
      case "SET_READY":
        this._handleSetReady(sender, msg.ready);
        break;
      case "REQUEST_START":
        this._handleRequestStart(sender);
        break;
      case "PLAYER_INPUT":
        this._handlePlayerInput(sender, msg);
        break;
      case "CHAT_SUBMIT":
        this._handleChatSubmit(sender, msg.sessionId, msg.message);
        break;
      case "ASSIST_TARGET":
        this._handleAssistTarget(sender, msg.targetPlayerId);
        break;
      default:
        this._sendError(sender, "UNKNOWN_MESSAGE", "Unknown message type");
    }
  }

  onClose(conn: Party.Connection): void {
    console.log(`[party] ${conn.id} disconnected`);

    const player = this._playerByConn(conn.id);
    if (!player) return;

    player.connected = false;
    player.connId = null;
    this._connToPlayerId.delete(conn.id);

    // If host disconnects, promote next connected player.
    if (this._hostId === player.id) {
      this._promoteNextHost();
    }

    // Immediately broadcast disconnect state so lobby/UI update without waiting.
    this._broadcastSnapshot();

    // Pause tick if room empties.
    const connectedCount = this._connectedHumans().length;
    if (connectedCount === 0 && this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  private _handleJoinRoom(
    conn: Party.Connection,
    name: string,
    rawClientId?: string,
    inviteCode?: string
  ): void {
    // Invite gating: when INVITE_SECRET is set, reject connections without a valid code.
    // Check both process.env (deployed PartyKit) and room.env (local --var).
    const secret =
      process.env.INVITE_SECRET ||
      (this.room.env as Record<string, string | undefined>).INVITE_SECRET;
    if (secret && inviteCode !== secret) {
      this._sendError(conn, "INVITE_INVALID", "Invalid invite code");
      conn.close();
      return;
    }

    const now = Date.now();
    const clientId = rawClientId?.trim() || `anon_${conn.id}`;

    // Idempotent re-join on same open connection.
    const existingForConn = this._playerByConn(conn.id);
    if (existingForConn) {
      existingForConn.connected = true;
      existingForConn.name = name || existingForConn.name;
      existingForConn.lastUpdateMs = now;
      this._sendWelcome(conn, existingForConn.id);
      this._broadcastSnapshot();
      return;
    }

    // Reconnect path by stable client identity.
    const existingByClient = this._findPlayerByClientId(clientId);
    if (existingByClient) {
      if (existingByClient.connected) {
        this._sendError(conn, "ALREADY_CONNECTED", "Client is already connected");
        return;
      }
      if (existingByClient.connId) {
        this._connToPlayerId.delete(existingByClient.connId);
      }
      existingByClient.connected = true;
      existingByClient.connId = conn.id;
      existingByClient.name = name || existingByClient.name;
      existingByClient.lastUpdateMs = now;
      this._connToPlayerId.set(conn.id, existingByClient.id);

      this._sendWelcome(conn, existingByClient.id);
      this._broadcastSnapshot();
      return;
    }

    // New joins are only allowed in lobby.
    if (this._phase !== "lobby") {
      this._sendError(conn, "GAME_IN_PROGRESS", "Game already started");
      return;
    }

    if (this._connectedHumans().length >= MAX_PLAYERS) {
      this._sendError(conn, "ROOM_FULL", "Room is full");
      return;
    }

    const playerId = this._newPlayerId();
    const player: PlayerRecord = {
      id: playerId,
      clientId,
      connId: conn.id,
      name: name || `Player ${this._players.size + 1}`,
      isBot: false,
      lifeState: "alive",
      position: { x: 0, y: 1.8, z: START_Z },
      yaw: 0,
      pitch: 0,
      connected: true,
      isReady: false,
      lastUpdateMs: now,
      recatchGraceUntilMs: 0,
    };

    this._players.set(playerId, player);
    this._connToPlayerId.set(conn.id, playerId);

    if (!this._hostId || !this._players.get(this._hostId)?.connected) {
      this._hostId = playerId;
    }

    this._sendWelcome(conn, playerId);
    this._broadcastSnapshot();
  }

  private _handleSetReady(conn: Party.Connection, ready: boolean): void {
    const player = this._playerByConn(conn.id);
    if (!player || this._phase !== "lobby") return;
    player.isReady = ready;
    this._broadcastSnapshot();
  }

  private _handleRequestStart(conn: Party.Connection): void {
    const requester = this._playerByConn(conn.id);
    if (!requester || requester.id !== this._hostId) {
      this._sendError(conn, "NOT_HOST", "Only host can start");
      return;
    }
    if (this._phase !== "lobby") return;

    const connected = this._connectedHumans();
    if (connected.length < MIN_PLAYERS_TO_START) {
      this._sendError(conn, "NOT_ENOUGH", "Need at least 1 player");
      return;
    }

    const allReady = connected.every((p) => p.isReady);
    if (!allReady) {
      this._sendError(conn, "NOT_READY", "Not all players are ready");
      return;
    }

    this._startGame();
  }

  private _handlePlayerInput(
    conn: Party.Connection,
    input: { moveH: number; moveV: number; yaw: number; pitch: number; dtMs: number }
  ): void {
    const player = this._playerByConn(conn.id);
    if (!player || this._phase !== "playing" || player.lifeState !== "alive") return;

    const dtSeconds = Math.min(input.dtMs / 1000, 0.1);
    const dtScale = Math.max(0.25, Math.min(2.5, dtSeconds * 60));

    player.yaw = input.yaw;
    player.pitch = input.pitch;

    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);
    const moveH = Math.max(-1, Math.min(1, input.moveH));
    const moveV = Math.max(-1, Math.min(1, input.moveV));

    const dx = (moveH * cosYaw + moveV * sinYaw) * PLAYER_SPEED * dtScale;
    const dz = (-moveH * sinYaw + moveV * cosYaw) * PLAYER_SPEED * dtScale;

    const halfW = MAP_WIDTH / 2 - 1;
    const halfD = MAP_DEPTH / 2 - 1;
    player.position.x = Math.max(-halfW, Math.min(halfW, player.position.x + dx));
    player.position.z = Math.max(-halfD, Math.min(halfD, player.position.z + dz));
    player.lastUpdateMs = Date.now();
  }

  private _handleChatSubmit(
    conn: Party.Connection,
    sessionId: string,
    message: string
  ): void {
    const sender = this._playerByConn(conn.id);
    if (
      !sender ||
      this._phase !== "argument" ||
      !this._argumentState.active ||
      this._argumentState.caughtPlayerId !== sender.id
    ) {
      this._sendError(conn, "NOT_CAUGHT", "You are not the caught player");
      return;
    }

    if (
      this._argumentState.session &&
      this._argumentState.session.id !== sessionId
    ) {
      return; // stale session
    }

    this._processChatRound(message.trim());
  }

  private _processChatRound(message: string): void {
    const nowMs = Date.now();
    const trimmed = message.trim();
    this._logicState = gameUpdater(
      this._logicState,
      trimmed.length > 0
        ? { type: "CHAT_MESSAGE", message: trimmed, nowMs }
        : { type: "ROUND_TIMEOUT", nowMs }
    );

    const session = this._logicState.argument;
    if (!session) return;

    this._argumentState.session = session;

    if (session.outcome !== "in_progress") {
      const caughtId = this._argumentState.caughtPlayerId!;
      const caughtPlayer = this._players.get(caughtId);

      if (session.outcome === "won") {
        if (caughtPlayer) {
          caughtPlayer.lifeState = "alive";
          caughtPlayer.recatchGraceUntilMs = nowMs + RECATCH_GRACE_MS;
        }
        this._broadcastEvent({ type: "PLAYER_ESCAPED", playerId: caughtId });
        this._logicState = gameUpdater(this._logicState, {
          type: "ARGUMENT_WON",
          nowMs,
        });
      } else {
        if (caughtPlayer) {
          caughtPlayer.lifeState = "eaten";
        }
        this._broadcastEvent({ type: "PLAYER_EATEN", playerId: caughtId });
        this._logicState = gameUpdater(this._logicState, {
          type: "ARGUMENT_LOST",
          nowMs,
        });
      }

      this._logicState = gameUpdater(this._logicState, {
        type: "RESET_ARGUMENT",
        nowMs,
      });
      this._argumentState = {
        active: false,
        caughtPlayerId: null,
        session: null,
        activeTyperId: null,
      };
      this._phase = "playing";
      this._checkGameOver();
    } else {
      this._broadcastEvent({
        type: "ARGUMENT_ROUND_RESOLVED",
        sessionId: session.id,
        round: session.currentRound,
        points: session.totalScore,
      });

      // Fire-and-forget Azure monster reply upgrade
      const currentRound = session.currentRound - 1; // just-resolved round index
      const roundData = session.rounds[currentRound];
      if (roundData?.playerMessage && this._argumentState.session) {
        const sessionRef = this._argumentState.session;
        generateMonsterReply(
          currentRound,
          roundData.playerMessage,
          roundData.points
        )
          .then((llmReply) => {
            if (
              llmReply &&
              this._argumentState.session &&
              this._argumentState.session.id === sessionRef.id
            ) {
              const round = this._argumentState.session.rounds[currentRound];
              if (round) {
                round.monsterReply = llmReply;
                this._broadcastSnapshot();
              }
            }
          })
          .catch((err) =>
            console.warn(`[party] Azure monster reply failed: ${String(err)}`)
          );
      }
    }

    this._broadcastSnapshot();
  }

  private _handleAssistTarget(
    conn: Party.Connection,
    targetPlayerId: string
  ): void {
    const sender = this._playerByConn(conn.id);
    if (!sender || sender.lifeState !== "eaten") return;

    const target = this._players.get(targetPlayerId);
    if (!target || target.lifeState !== "alive") return;

    const now = Date.now();
    const lastCooldown = this._assistCooldowns.get(sender.id) ?? 0;
    if (now < lastCooldown) return;

    this._assistCooldowns.set(sender.id, now + ASSIST_COOLDOWN_MS);
    this._assists.set(sender.id, {
      targetPlayerId,
      effectUntilMs: now + ASSIST_EFFECT_MS,
    });
  }

  private _spawnBots(): void {
    const humanCount = this._connectedHumans().length;
    const maxBots = BOT_FILL_TO_MAX ? MAX_PLAYERS - humanCount : BOT_COUNT;
    const botsNeeded = Math.max(0, Math.min(BOT_COUNT, maxBots));
    const now = Date.now();

    for (let i = 1; i <= botsNeeded; i += 1) {
      const totalPlayers = humanCount + i;
      const spawnOffset = (totalPlayers - 1) * 2 - (MAX_PLAYERS - 1);
      const bot: BotRecord = createBot(i, this.room.id, spawnOffset, now);
      this._players.set(bot.id, bot as unknown as PlayerRecord);
    }
  }

  private _removeBots(): void {
    for (const [id, player] of this._players) {
      if (player.isBot) {
        this._players.delete(id);
      }
    }
  }

  private _startGame(): void {
    this._phase = "playing";
    this._result = null;

    // Spawn bots before positioning
    this._spawnBots();

    const allPlayers = [...this._players.values()].filter(
      (p) => p.connected
    );
    let i = 0;
    for (const player of allPlayers) {
      const offset = (i - (allPlayers.length - 1) / 2) * 2;
      player.position = { x: offset, y: 1.8, z: START_Z };
      player.yaw = 0;
      player.pitch = 0;
      player.lifeState = "alive";
      if (!player.isBot) {
        player.recatchGraceUntilMs = 0;
      }
      i += 1;
    }

    for (const player of this._players.values()) {
      if (!player.connected) {
        player.isReady = false;
      }
    }

    this._monster = {
      position: { x: 0, y: 1.6, z: START_Z + 55 },
      yaw: 0,
      state: "patrol",
      targetPlayerId: null,
      patrolIndex: 0,
      patrolPoints: createPatrolPoints(),
    };

    if (this._tickInterval) clearInterval(this._tickInterval);
    this._tickInterval = setInterval(() => this._tick(), TICK_MS);

    this._broadcastSnapshot();
  }

  private _tick(): void {
    if (this._phase !== "playing") return;

    const now = Date.now();
    const dtSeconds = TICK_MS / 1000;

    this._tickBots(dtSeconds, now);
    this._updateMonster(dtSeconds, now);
    this._checkCatch(now);
    this._checkFinishZone();
    this._broadcastSnapshot();
  }

  private _tickBots(dtSeconds: number, now: number): void {
    for (const player of this._players.values()) {
      if (player.isBot && player.lifeState === "alive") {
        tickBotMovement(player as unknown as BotRecord, dtSeconds, now);
      }
    }
  }

  private _updateMonster(dtSeconds: number, now: number): void {
    const m = this._monster;
    const alivePlayers = this._alivePlayers();

    if (alivePlayers.length === 0) return;

    let closestPlayer: PlayerRecord | null = null;
    let closestDist = Infinity;

    for (const p of alivePlayers) {
      const dist = planarDist(m.position, p.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = p;
      }
    }

    let targetPlayer = closestPlayer;
    for (const assist of this._assists.values()) {
      if (now > assist.effectUntilMs) continue;
      const assistTarget = this._players.get(assist.targetPlayerId);
      if (assistTarget && assistTarget.lifeState === "alive") {
        const dist = planarDist(m.position, assistTarget.position);
        if (dist < MONSTER_DETECT_RANGE * 1.5) {
          targetPlayer = assistTarget;
          break;
        }
      }
    }

    if (closestDist <= MONSTER_DETECT_RANGE) {
      m.state = "chase";
    } else if (closestDist > MONSTER_DETECT_RANGE * 1.4) {
      m.state = "patrol";
    }

    const dtScale = Math.max(0.25, Math.min(2.5, dtSeconds * 60));

    let target: Vec3;
    if (m.state === "chase" && targetPlayer) {
      target = {
        x: targetPlayer.position.x,
        y: m.position.y,
        z: targetPlayer.position.z,
      };
      m.targetPlayerId = targetPlayer.id;
    } else {
      target = m.patrolPoints[m.patrolIndex];
      m.targetPlayerId = null;
    }

    if (m.state === "patrol" && planarDist(m.position, target) <= 1.2) {
      m.patrolIndex = (m.patrolIndex + 1) % m.patrolPoints.length;
      target = m.patrolPoints[m.patrolIndex];
    }

    const toX = target.x - m.position.x;
    const toZ = target.z - m.position.z;
    const len = Math.sqrt(toX * toX + toZ * toZ);
    if (len > 0.001) {
      const dirX = toX / len;
      const dirZ = toZ / len;
      m.position.x += dirX * MONSTER_SPEED * dtScale;
      m.position.z += dirZ * MONSTER_SPEED * dtScale;
      m.yaw = Math.atan2(dirX, dirZ);
    }

    const halfW = MAP_WIDTH / 2 - 1;
    const halfD = MAP_DEPTH / 2 - 1;
    m.position.x = Math.max(-halfW, Math.min(halfW, m.position.x));
    m.position.z = Math.max(-halfD, Math.min(halfD, m.position.z));
  }

  private _checkCatch(now: number): void {
    if (this._argumentState.active) return;

    const m = this._monster;
    for (const player of this._alivePlayers()) {
      if (now < player.recatchGraceUntilMs) continue;

      const dist = planarDist(m.position, player.position);
      if (dist <= CATCH_RADIUS) {
        this._triggerCatch(player, now);
        return;
      }
    }
  }

  private _triggerCatch(player: PlayerRecord, now: number): void {
    player.lifeState = "caught";
    this._phase = "argument";

    this._logicState = gameUpdater(this._logicState, {
      type: "PLAYER_CAUGHT",
      nowMs: now,
    });

    const session = this._logicState.argument;
    this._argumentState = {
      active: true,
      caughtPlayerId: player.id,
      session,
      activeTyperId: player.id,
    };

    this._broadcastEvent({ type: "PLAYER_CAUGHT", playerId: player.id });
    if (session) {
      this._broadcastEvent({
        type: "ARGUMENT_STARTED",
        sessionId: session.id,
        caughtPlayerId: player.id,
      });
    }

    this._broadcastSnapshot();

    // If the caught player is a bot, drive the argument automatically
    if (player.isBot) {
      const sessionId = session?.id ?? "";
      this._driveBotArgument(player.id, sessionId);
    }
  }

  private _driveBotArgument(botPlayerId: string, sessionId: string): void {
    this._driveBotArgumentAsync(botPlayerId, sessionId).catch((err) =>
      console.warn(`[party] Bot argument drive failed: ${String(err)}`)
    );
  }

  private async _driveBotArgumentAsync(
    botPlayerId: string,
    sessionId: string
  ): Promise<void> {
    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    for (let round = 0; round < 3; round += 1) {
      await delay(2500);

      // Session-ID guard: abort if session changed
      if (
        !this._argumentState.active ||
        !this._argumentState.session ||
        this._argumentState.session.id !== sessionId ||
        this._argumentState.caughtPlayerId !== botPlayerId
      ) {
        return;
      }

      const message = await resolveBotChatMessage(
        round,
        generateBotChatMessage
      );

      // Re-check session after async operation
      if (
        !this._argumentState.active ||
        !this._argumentState.session ||
        this._argumentState.session.id !== sessionId ||
        this._argumentState.caughtPlayerId !== botPlayerId
      ) {
        return;
      }

      this._processChatRound(message);

      // If argument resolved (won/lost/reset), stop driving
      if (!this._argumentState.active) {
        return;
      }
    }
  }

  private _checkFinishZone(): void {
    for (const player of this._alivePlayers()) {
      if (player.position.z >= FINISH_Z) {
        player.lifeState = "escaped";
        this._broadcastEvent({ type: "PLAYER_ESCAPED", playerId: player.id });
      }
    }

    const active = this._activePlayersForOutcome();
    const alive = active.filter((p) => p.lifeState === "alive");
    const escaped = active.filter((p) => p.lifeState === "escaped");
    if (alive.length === 0 && escaped.length > 0) {
      this._endGame(GameResult.WIN);
    }
  }

  private _checkGameOver(): void {
    const active = this._activePlayersForOutcome();
    const alive = active.filter((p) => p.lifeState === "alive");
    const escaped = active.filter((p) => p.lifeState === "escaped");
    const eaten = active.filter((p) => p.lifeState === "eaten");

    if (active.length > 0 && alive.length === 0) {
      if (escaped.length > 0) {
        this._endGame(GameResult.WIN);
      } else if (eaten.length === active.length) {
        this._endGame(GameResult.EATEN);
      }
    }
  }

  private _endGame(result: GameResult): void {
    this._removeBots();
    this._phase = "game_over";
    this._result = result;

    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }

    this._broadcastEvent({ type: "GAME_OVER", result });
    this._broadcastSnapshot();
  }

  private _buildSnapshot(): RoomSnapshot {
    const players: NetworkPlayerState[] = [];
    for (const p of this._players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        lifeState: p.lifeState,
        position: { ...p.position },
        yaw: p.yaw,
        pitch: p.pitch,
        connected: p.connected,
        isReady: p.isReady,
        lastUpdateMs: p.lastUpdateMs,
      });
    }

    return {
      serverTimeMs: Date.now(),
      phase: this._phase,
      hostId: this._hostId,
      players,
      monster: {
        position: { ...this._monster.position },
        yaw: this._monster.yaw,
        state: this._monster.state,
        targetPlayerId: this._monster.targetPlayerId,
      },
      argument: { ...this._argumentState },
      result: this._result,
    };
  }

  private _broadcastSnapshot(): void {
    const msg: ServerMessage = {
      type: "ROOM_SNAPSHOT",
      snapshot: this._buildSnapshot(),
    };
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }

  private _broadcastEvent(event: RoomEvent): void {
    const msg: ServerMessage = { type: "ROOM_EVENT", event };
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }

  private _sendError(conn: Party.Connection, code: string, message: string): void {
    const msg: ServerMessage = { type: "ERROR", code, message };
    conn.send(JSON.stringify(msg));
  }

  private _sendWelcome(conn: Party.Connection, selfId: string): void {
    const welcome: ServerMessage = {
      type: "WELCOME",
      selfId,
      roomId: this.room.id,
      tickRate: TICK_RATE,
      maxPlayers: MAX_PLAYERS,
    };
    conn.send(JSON.stringify(welcome));
  }

  private _newPlayerId(): string {
    while (true) {
      const candidate = `player_${this._nextPlayerNumber++}`;
      if (!this._players.has(candidate)) return candidate;
    }
  }

  private _findPlayerByClientId(clientId: string): PlayerRecord | null {
    for (const player of this._players.values()) {
      if (player.clientId === clientId) return player;
    }
    return null;
  }

  private _playerByConn(connId: string): PlayerRecord | null {
    const playerId = this._connToPlayerId.get(connId);
    if (!playerId) return null;
    return this._players.get(playerId) ?? null;
  }

  private _connectedPlayers(): PlayerRecord[] {
    return [...this._players.values()].filter((p) => p.connected);
  }

  private _connectedHumans(): PlayerRecord[] {
    return [...this._players.values()].filter((p) => p.connected && !p.isBot);
  }

  private _alivePlayers(): PlayerRecord[] {
    return [...this._players.values()].filter(
      (p) => p.lifeState === "alive" && p.connected
    );
  }

  private _activePlayersForOutcome(): PlayerRecord[] {
    return [...this._players.values()].filter(
      (p) => p.connected || p.lifeState !== "alive"
    );
  }

  private _promoteNextHost(): void {
    const connected = this._connectedHumans();
    this._hostId = connected.length > 0 ? connected[0].id : null;
  }
}
