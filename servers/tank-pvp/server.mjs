#!/usr/bin/env node
/**
 * Global matchmaking + Room-Relay für Panzer-Artillerie (PvP-Basis).
 *
 * Start: npm run pvp-server
 * Port: PVP_PORT oder PORT (Standard 8788)
 *
 * Protokoll (JSON über WebSocket):
 *  Client → Server: find_match | cancel_search | leave_room | relay | ping
 *  Server → Client: welcome | queued | matched | peer_left | relay | error | pong
 */
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PVP_PORT || process.env.PORT || 8788);
const GAME_KEY = "tank-artillery";

/** @typedef {{ id: string, state: 'idle'|'queued'|'room', game?: string, roomId?: string, role?: 0|1, peer?: import('ws').WebSocket }} Meta */

/** @type {Map<string, import('ws').WebSocket[]>} */
const queues = new Map();

/** @type {WeakMap<import('ws').WebSocket, Meta>} */
const metas = new WeakMap();

/** @type {Map<string, { roomId: string, sockets: [import('ws').WebSocket, import('ws').WebSocket] }>} */
const rooms = new Map();

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function removeFromQueue(ws, gameKey) {
  const q = queues.get(gameKey);
  if (!q) return;
  const i = q.indexOf(ws);
  if (i >= 0) q.splice(i, 1);
}

function destroyRoom(roomId, reason, skipWs) {
  const R = rooms.get(roomId);
  if (!R) return;
  rooms.delete(roomId);
  for (const peer of R.sockets) {
    if (peer === skipWs) continue;
    const m = metas.get(peer);
    if (m) {
      m.state = "idle";
      delete m.roomId;
      delete m.role;
      delete m.peer;
    }
    send(peer, { type: "peer_left", reason: reason ?? "peer_disconnected" });
  }
}

function tryPair(gameKey) {
  let q = queues.get(gameKey);
  while (q && q.length >= 2) {
    const a = q.shift();
    const b = q.shift();
    if (!a || !b) break;
    const ma = metas.get(a);
    const mb = metas.get(b);
    if (!ma || !mb) continue;
    if (ma.state !== "queued" || mb.state !== "queued") continue;

    const roomId = randomUUID();
    ma.state = "room";
    ma.roomId = roomId;
    ma.role = 0;
    ma.peer = b;

    mb.state = "room";
    mb.roomId = roomId;
    mb.role = 1;
    mb.peer = a;

    rooms.set(roomId, { roomId, sockets: [a, b] });

    send(a, { type: "matched", roomId, role: 0, game: gameKey });
    send(b, { type: "matched", roomId, role: 1, game: gameKey });
  }
}

function onDisconnect(ws) {
  const m = metas.get(ws);
  if (!m) return;
  if (m.state === "queued" && m.game) {
    removeFromQueue(ws, m.game);
  }
  if (m.state === "room" && m.roomId) {
    destroyRoom(m.roomId, "peer_disconnected", ws);
  }
  m.state = "idle";
  delete m.roomId;
  delete m.role;
  delete m.peer;
  delete m.game;
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  const id = randomUUID().slice(0, 8);
  metas.set(ws, { id, state: "idle" });
  send(ws, { type: "welcome", clientId: id });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", code: "bad_json", message: "Ungültige Nachricht" });
      return;
    }
    if (!msg || typeof msg !== "object") return;

    const m = metas.get(ws);
    if (!m) return;

    const type = msg.type;
    if (type === "ping") {
      send(ws, { type: "pong", t: Date.now() });
      return;
    }

    if (type === "cancel_search") {
      if (m.state === "queued" && m.game) {
        removeFromQueue(ws, m.game);
        m.state = "idle";
        delete m.game;
      }
      return;
    }

    if (type === "leave_room") {
      if (m.state === "room" && m.roomId) {
        const rid = m.roomId;
        destroyRoom(rid, "peer_left_room", ws);
      }
      m.state = "idle";
      delete m.roomId;
      delete m.role;
      delete m.peer;
      delete m.game;
      return;
    }

    if (type === "find_match") {
      const game = typeof msg.game === "string" ? msg.game : GAME_KEY;
      if (m.state === "room") {
        send(ws, { type: "error", code: "already_matched", message: "Bereits in einer Partie." });
        return;
      }
      if (m.state === "queued") {
        send(ws, { type: "queued", position: 1, game });
        return;
      }
      m.state = "queued";
      m.game = game;
      if (!queues.has(game)) queues.set(game, []);
      const q = queues.get(game);
      q.push(ws);
      send(ws, { type: "queued", position: q.length, game });
      tryPair(game);
      return;
    }

    if (type === "relay") {
      if (m.state !== "room" || !m.peer) {
        send(ws, { type: "error", code: "no_peer", message: "Kein Gegner verbunden." });
        return;
      }
      send(m.peer, { type: "relay", fromRole: m.role, payload: msg.payload });
      return;
    }
  });

  ws.on("close", () => onDisconnect(ws));
});

process.stderr.write(`[tank-pvp] ws://127.0.0.1:${PORT}  (game: ${GAME_KEY})\n`);
