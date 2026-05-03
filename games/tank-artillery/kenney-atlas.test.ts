import { expect, test } from "vitest";
import { ATLAS, GENERATED_TANK_SPRITES } from "./kenney-atlas";

test("Kenney-Atlas enthält Panzer-Kacheln und neue Shop-Skins", () => {
  const tiles = [
    ATLAS.tankPlayerGreen,
    ATLAS.tankGreenEnemy,
    ATLAS.tankNavy,
    ATLAS.tankGrey,
    ATLAS.tankDesert,
    ATLAS.tankCrimson,
    ATLAS.tankBunker,
    ATLAS.tankViper,
  ];
  for (const r of tiles) {
    expect(r.w).toBeGreaterThanOrEqual(160);
    expect(r.w).toBeLessThanOrEqual(184);
    expect(r.h).toBeGreaterThanOrEqual(95);
    expect(r.h).toBeLessThanOrEqual(137);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  }
  expect(ATLAS.bulletFly3.w).toBeGreaterThan(0);
});

test("generierte Panzer-Sprite-Sheets haben vier Animation-Frames", () => {
  for (const def of Object.values(GENERATED_TANK_SPRITES)) {
    expect(def.src).toContain("/games/tank-artillery/generated/");
    expect(def.frameW).toBe(384);
    expect(def.frameH).toBe(1024);
    expect(def.frames).toHaveLength(4);
    expect(def.sourceBodyW).toBe(def.frames[0]!.w);
    expect(def.sourceBodyH).toBe(def.frames[0]!.h);
    expect(def.targetW).toBeGreaterThan(100);
    const bodyScale = def.targetW / def.sourceBodyW;
    for (const frame of def.frames) {
      expect(frame.w).toBeGreaterThan(250);
      expect(frame.h).toBeGreaterThan(140);
      expect(def.sourceBodyW * bodyScale).toBe(def.targetW);
    }
  }
});
