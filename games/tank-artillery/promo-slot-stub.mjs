/**
 * Dev & Playwright: zählt weltweite Promo-Slots (max. 3).
 * Start: node games/tank-artillery/promo-slot-stub.mjs
 * Sync mit PROMO_GLOBAL_MAX_SLOTS in artillery-logic.ts
 */
import http from "node:http";

const PORT = Number(process.env.PROMO_STUB_PORT ?? 5799);
const MAX = Number(process.env.PROMO_STUB_MAX ?? 3);
let n = 0;

/** @type {Record<string, string>} */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function applyCors(res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
}

http
  .createServer((req, res) => {
    applyCors(res);
    const path = req.url?.split("?")[0] ?? "";

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === "/reset" && req.method === "POST") {
      n = 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (path === "/claim" && req.method === "POST") {
      res.setHeader("Content-Type", "application/json");
      if (n >= MAX) {
        res.writeHead(429);
        res.end(JSON.stringify({ ok: false, reason: "full" }));
        return;
      }
      n += 1;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && (path === "/" || path === "/health")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(PORT, "127.0.0.1", () => {
    process.stderr.write(`tank-artillery promo-slot-stub http://127.0.0.1:${PORT} (max ${MAX})\n`);
  });
