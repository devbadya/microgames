/** Build Vite with VITE_TANK_PROMO_CLAIM_URL=https://<worker>/claim */

const STORAGE_KEY = "tank_artillery_promo_claims_v1";
const MAX_SLOTS = 3; /** Sync mit PROMO_GLOBAL_MAX_SLOTS in games/tank-artillery/artillery-logic.ts */

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  /** Browser-Preflight mit Accept / Content-Type abdecken */
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export interface Env {
  PROMO: KVNamespace;
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, "") !== "/claim" || request.method !== "POST") {
      return json({ ok: false, reason: "not_found" }, 404);
    }

    let n = 0;
    const raw = await env.PROMO.get(STORAGE_KEY);
    if (raw != null && raw !== "") {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed)) n = parsed;
    }
    if (n >= MAX_SLOTS) {
      return json({ ok: false, reason: "full" }, 429);
    }
    await env.PROMO.put(STORAGE_KEY, String(n + 1));
    return json({ ok: true }, 200);
  },
};

export default handler;

function json(body: { ok?: boolean; reason?: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}
