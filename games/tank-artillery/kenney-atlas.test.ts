import { expect, test } from "vitest";
import { ATLAS } from "./kenney-atlas";

test("Kenney-Atlas enthält Panzer-Kacheln (172 px breit) und Wüsten-Skin", () => {
  const tiles = [ATLAS.tankPlayerGreen, ATLAS.tankGreenEnemy, ATLAS.tankNavy, ATLAS.tankGrey, ATLAS.tankDesert];
  for (const r of tiles) {
    expect(r.w).toBe(172);
    expect(r.h).toBeGreaterThanOrEqual(110);
    expect(r.h).toBeLessThanOrEqual(128);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  }
  expect(ATLAS.bulletFly3.w).toBeGreaterThan(0);
});
