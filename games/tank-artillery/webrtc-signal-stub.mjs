/**
 * Dev: WebRTC signaling relay (max 2 WebSocket clients per ?room=).
 * Start: pnpm run webrtc-stub
 * Example: ws://127.0.0.1:5800?room=demo
 */
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.WEBRTC_SIGNAL_PORT ?? 5800);

/** @typedef {{ peers: import('ws').WebSocket[] }} RoomBucket */

/** @type {Map<string, RoomBucket>} */
const rooms = new Map();

/**
 * @param {string | undefined} reqUrl
 */
function roomIdFromUrl(reqUrl) {
  const u = new URL(reqUrl ?? "/", "http://127.0.0.1");
  const r = u.searchParams.get("room");
  return r != null && r.trim() !== "" ? r.trim() : "default";
}

const server = http.createServer((req, res) => {
  const path = req.url?.split("?")[0] ?? "";
  if (req.method === "GET" && (path === "/" || path === "/health")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const roomId = roomIdFromUrl(req.url);
  let bucket = rooms.get(roomId);
  if (!bucket) {
    bucket = { peers: [] };
    rooms.set(roomId, bucket);
  }
  if (bucket.peers.length >= 2) {
    ws.close(4000, "room_full");
    return;
  }
  bucket.peers.push(ws);

  /**
   * @param {import('ws').RawData} data
   */
  const broadcastOthers = (data) => {
    for (const p of bucket.peers) {
      if (p !== ws && p.readyState === WebSocket.OPEN) p.send(data);
    }
  };

  if (bucket.peers.length === 1) {
    ws.send(JSON.stringify({ type: "signal-meta", waiting: true }));
  } else {
    const [a, b] = bucket.peers;
    a.send(JSON.stringify({ type: "signal-meta", role: "offerer" }));
    b.send(JSON.stringify({ type: "signal-meta", role: "answerer" }));
  }

  ws.on("message", (data) => {
    broadcastOthers(data);
  });

  ws.on("close", () => {
    bucket.peers = bucket.peers.filter((p) => p !== ws);
    if (bucket.peers.length === 0) rooms.delete(roomId);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(
    `webrtc-signal-stub ws://127.0.0.1:${PORT}?room=demo (GET /health)\n`,
  );
});
