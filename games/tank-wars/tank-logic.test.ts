import { describe, expect, test } from "vitest";
import {
  ARENA,
  XP_PER_WIN,
  circleHitsWall,
  clampToArena,
  distSq,
  getLoadout,
  levelFromXp,
  readStoredXp,
  spreadAngles,
} from "./tank-logic";

describe("arena", () => {
  test("clampToArena", () => {
    expect(clampToArena(ARENA.W, 100, 20)).toEqual([ARENA.W - 20 - 4, 100]);
  });
});

describe("walls", () => {
  test("circleHitsWall detects overlap", () => {
    const walls = [{ x: 100, y: 100, w: 80, h: 40 }];
    expect(circleHitsWall(140, 120, 8, walls)).not.toBeNull();
    expect(circleHitsWall(10, 10, 8, walls)).toBeNull();
  });
});

describe("spreadAngles", () => {
  test("triple fan", () => {
    const a = spreadAngles(1, 3, 0.2);
    expect(a.length).toBe(3);
    expect(a[0]).toBeCloseTo(0.8);
    expect(a[1]).toBeCloseTo(1);
    expect(a[2]).toBeCloseTo(1.2);
  });
});

describe("loadouts", () => {
  test("five unique shot profiles", () => {
    expect(getLoadout("ghost")?.fire.pierce).toBe(1);
    expect(getLoadout("scatter")?.fire.count).toBe(3);
    expect(XP_PER_WIN).toBeGreaterThan(0);
  });
});

describe("distSq", () => {
  test("unit", () => {
    expect(distSq(0, 0, 3, 4)).toBe(25);
  });
});

describe("levelFromXp", () => {
  test("starts at 1", () => {
    expect(levelFromXp(0)).toBe(1);
  });
  test("rises", () => {
    expect(levelFromXp(400)).toBeGreaterThanOrEqual(4);
  });
  test("negative wird wie 0 gezählt", () => {
    expect(levelFromXp(-50)).toBe(1);
  });
});

describe("readStoredXp", () => {
  test("returns finite non-negative default", () => {
    const xp = readStoredXp();
    expect(xp).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(xp)).toBe(true);
  });
});
