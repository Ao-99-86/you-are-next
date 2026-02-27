import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  RoomEvent,
  RoomSnapshot,
  ServerMessage,
} from "../../game/types";

const PARTYKIT_HOST =
  import.meta.env?.VITE_PARTYKIT_HOST || "127.0.0.1:1999";

const INPUT_SEND_INTERVAL_MS = 50; // 20 Hz
const CLIENT_ID_KEY = "you-are-next-client-id";

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return createClientId();
  try {
    const stored = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    const next = createClientId();
    window.sessionStorage.setItem(CLIENT_ID_KEY, next);
    return next;
  } catch {
    return createClientId();
  }
}

export interface GameRoomCallbacks {
  onEvent?: (event: RoomEvent) => void;
  onSnapshot?: (snapshot: RoomSnapshot) => void;
}

export interface GameRoomAPI {
  connect: (roomId: string, name: string) => void;
  disconnect: () => void;
  setReady: (ready: boolean) => void;
  requestStart: () => void;
  sendInput: (input: {
    moveH: number;
    moveV: number;
    yaw: number;
    pitch: number;
    dtMs: number;
  }) => void;
  submitChat: (sessionId: string, message: string) => void;
  assistTarget: (targetPlayerId: string) => void;
  selfId: string | null;
  snapshot: RoomSnapshot | null;
  connected: boolean;
}

export function useGameRoom(callbacks?: GameRoomCallbacks): GameRoomAPI {
  const [selfId, setSelfId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const seqRef = useRef(0);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback((roomId: string, name: string) => {
    // Close existing connection
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socket.addEventListener("open", () => {
      setConnected(true);
      // Send join message
      const joinMsg: ClientMessage = {
        type: "JOIN_ROOM",
        roomId,
        name,
        clientId: clientIdRef.current,
      };
      socket.send(JSON.stringify(joinMsg));
    });

    socket.addEventListener("close", () => {
      setConnected(false);
    });

    socket.addEventListener("message", (evt) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "WELCOME":
          setSelfId(msg.selfId);
          break;
        case "ROOM_SNAPSHOT":
          setSnapshot(msg.snapshot);
          callbacksRef.current?.onSnapshot?.(msg.snapshot);
          break;
        case "ROOM_EVENT":
          callbacksRef.current?.onEvent?.(msg.event);
          break;
        case "ERROR":
          console.warn(`[room] Server error: ${msg.code} - ${msg.message}`);
          break;
      }
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
    setSelfId(null);
    setSnapshot(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const setReady = useCallback(
    (ready: boolean) => send({ type: "SET_READY", ready }),
    [send]
  );

  const requestStart = useCallback(
    () => send({ type: "REQUEST_START" }),
    [send]
  );

  const sendInput = useCallback(
    (input: {
      moveH: number;
      moveV: number;
      yaw: number;
      pitch: number;
      dtMs: number;
    }) => {
      seqRef.current += 1;
      send({
        type: "PLAYER_INPUT",
        seq: seqRef.current,
        ...input,
      });
    },
    [send]
  );

  const submitChat = useCallback(
    (sessionId: string, message: string) =>
      send({ type: "CHAT_SUBMIT", sessionId, message }),
    [send]
  );

  const assistTarget = useCallback(
    (targetPlayerId: string) =>
      send({ type: "ASSIST_TARGET", targetPlayerId }),
    [send]
  );

  return {
    connect,
    disconnect,
    setReady,
    requestStart,
    sendInput,
    submitChat,
    assistTarget,
    selfId,
    snapshot,
    connected,
  };
}
