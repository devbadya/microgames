/**
 * Client für den globalen Matchmaking-WebSocket-Server ({@link servers/tank-pvp/server.mjs}).
 * Konfiguration: `VITE_TANK_PVP_WS_URL` beim Build oder `window.__TANK_PVP_WS_URL__` vor Laden von main.
 */

export type PvpRole = 0 | 1;

export type PvpMatchmakingHandlers = {
  onWelcome?: (clientId: string) => void;
  onQueued?: (position: number, game: string) => void;
  onMatched?: (roomId: string, role: PvpRole, game: string) => void;
  onPeerLeft?: (reason: string) => void;
  onRelay?: (fromRole: PvpRole, payload: unknown) => void;
  onError?: (code: string, message: string) => void;
  onDisconnected?: () => void;
};

const GAME_ID = "tank-artillery";

declare global {
  interface Window {
    __TANK_PVP_WS_URL__?: string;
  }
}

interface ImportMetaEnv {
  readonly VITE_TANK_PVP_WS_URL?: string;
}

/** WebSocket-URL z. B. `ws://127.0.0.1:8788` — ohne URL kein Online-Button sinnvoll. */
export function resolveTankPvpWsUrl(): string | null {
  try {
    const w = typeof globalThis !== "undefined" && "window" in globalThis ? globalThis.window : undefined;
    const injected = typeof w?.__TANK_PVP_WS_URL__ === "string" ? w.__TANK_PVP_WS_URL__.trim() : "";
    if (injected) return injected;
  } catch {
    /** ignore */
  }
  const v =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env: ImportMetaEnv }).env?.VITE_TANK_PVP_WS_URL
      : undefined;
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

let socket: WebSocket | null = null;
let handlers: PvpMatchmakingHandlers = {};
let roomId: string | null = null;
let role: PvpRole | null = null;

export function getPvpSession(): { roomId: string | null; role: PvpRole | null } {
  return { roomId, role };
}

export function disconnectPvp(): void {
  roomId = null;
  role = null;
  if (socket) {
    try {
      socket.close();
    } catch {
      /** ignore */
    }
    socket = null;
  }
}

/** Nach `matched`: optional Nachrichten an den Gegner (späteres Spielfeld-Sync). */
export function sendPvpRelay(payload: unknown): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "relay", payload }));
}

export function leavePvpRoom(): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "leave_room" }));
  }
  roomId = null;
  role = null;
}

export function cancelPvpSearch(): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "cancel_search" }));
  }
  disconnectPvp();
}

/** Warteschlange oder Raum sauber beenden (für „Abbrechen“ in der Lobby). */
export function endPvpClientSession(): void {
  if (socket?.readyState === WebSocket.OPEN) {
    if (roomId != null) {
      socket.send(JSON.stringify({ type: "leave_room" }));
    } else {
      socket.send(JSON.stringify({ type: "cancel_search" }));
    }
  }
  disconnectPvp();
}

export function startPvpSearch(h: PvpMatchmakingHandlers): void {
  const url = resolveTankPvpWsUrl();
  disconnectPvp();
  handlers = h;

  if (!url) {
    handlers.onError?.("no_url", "Kein WebSocket-Server konfiguriert (VITE_TANK_PVP_WS_URL).");
    return;
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    handlers.onError?.("connect", "WebSocket konnte nicht geöffnet werden.");
    return;
  }
  socket = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "find_match", game: GAME_ID }));
  };

  ws.onerror = () => {
    handlers.onError?.("network", "Netzwerkfehler (Server erreichbar?).");
  };

  ws.onclose = () => {
    socket = null;
    roomId = null;
    role = null;
    handlers.onDisconnected?.();
  };

  ws.onmessage = (ev) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
    } catch {
      return;
    }
    const t = msg.type;
    if (t === "welcome" && typeof msg.clientId === "string") {
      handlers.onWelcome?.(msg.clientId);
      return;
    }
    if (t === "queued") {
      const pos = typeof msg.position === "number" ? msg.position : 1;
      const game = typeof msg.game === "string" ? msg.game : GAME_ID;
      handlers.onQueued?.(pos, game);
      return;
    }
    if (t === "matched" && typeof msg.roomId === "string" && (msg.role === 0 || msg.role === 1)) {
      roomId = msg.roomId;
      role = msg.role as PvpRole;
      const game = typeof msg.game === "string" ? msg.game : GAME_ID;
      handlers.onMatched?.(msg.roomId, role, game);
      return;
    }
    if (t === "peer_left" && typeof msg.reason === "string") {
      roomId = null;
      role = null;
      handlers.onPeerLeft?.(msg.reason);
      return;
    }
    if (t === "relay" && (msg.fromRole === 0 || msg.fromRole === 1)) {
      handlers.onRelay?.(msg.fromRole as PvpRole, msg.payload);
      return;
    }
    if (t === "error") {
      const code = typeof msg.code === "string" ? msg.code : "error";
      const message = typeof msg.message === "string" ? msg.message : "Unbekannter Fehler";
      handlers.onError?.(code, message);
    }
  };
}
