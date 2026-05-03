import { expect, test, vi } from "vitest";
import { resolveTankPvpWsUrl } from "./pvp-matchmaking";

test("resolveTankPvpWsUrl: window.__TANK_PVP_WS_URL__", () => {
  vi.stubGlobal("window", { __TANK_PVP_WS_URL__: " ws://127.0.0.1:8788 " });
  try {
    expect(resolveTankPvpWsUrl()).toBe("ws://127.0.0.1:8788");
  } finally {
    vi.unstubAllGlobals();
  }
});

test("resolveTankPvpWsUrl: ohne Konfiguration → null", () => {
  vi.stubGlobal("window", { __TANK_PVP_WS_URL__: undefined });
  try {
    expect(resolveTankPvpWsUrl()).toBe(null);
  } finally {
    vi.unstubAllGlobals();
  }
});
