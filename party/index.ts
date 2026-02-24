import type { Party } from "partykit/server";

export default class GameServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    console.log(`[party] ${conn.id} connected to room ${this.room.id}`);
    conn.send(JSON.stringify({ type: "WELCOME", id: conn.id }));
  }

  onMessage(message: string, sender: Party.Connection) {
    console.log(`[party] message from ${sender.id}:`, message);
  }

  onClose(conn: Party.Connection) {
    console.log(`[party] ${conn.id} disconnected`);
  }
}
