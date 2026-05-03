import { describe, expect, it } from "vitest";
import {
  LEVELS,
  clampLevel,
  failRun,
  gateGapSize,
  gateGapY,
  levelById,
  passGate,
  pickHazard,
  progressLabel,
  readBest,
  readUnlocked,
  recordBest,
  spawnGate,
  startRun,
  unlockNext,
  writeBest,
  writeUnlocked,
  type StorageLike,
} from "./sky-logic";

function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}

describe("sky-hopper levels", () => {
  it("defines 10 monotonically harder levels", () => {
    expect(LEVELS.length).toBe(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.pipeSpeed).toBeGreaterThan(LEVELS[i - 1]!.pipeSpeed - 0.0001);
      expect(LEVELS[i]!.pipeGap).toBeLessThan(LEVELS[i - 1]!.pipeGap + 0.0001);
      expect(LEVELS[i]!.goalGates).toBeGreaterThanOrEqual(LEVELS[i - 1]!.goalGates);
    }
    expect(LEVELS[0]!.id).toBe(1);
    expect(LEVELS.at(-1)!.id).toBe(10);
  });

  it("clampLevel keeps ids inside the campaign", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-3)).toBe(1);
    expect(clampLevel(1.7)).toBe(1);
    expect(clampLevel(11)).toBe(10);
    expect(clampLevel(Number.NaN)).toBe(1);
  });

  it("levelById returns matching level def", () => {
    expect(levelById(5)?.name).toBe("Spire Belt");
    expect(levelById(99)).toBeUndefined();
  });
});

describe("hazard selection", () => {
  it("level 1 always returns static (no variants)", () => {
    const def = levelById(1)!;
    for (let i = 0; i < 25; i++) {
      expect(pickHazard(def, () => Math.random())).toBe("static");
    }
  });

  it("respects hazardChance threshold", () => {
    const def = levelById(3)!;
    expect(pickHazard(def, seqRng([0.99]))).toBe("static");
    expect(pickHazard(def, seqRng([0.0, 0.0]))).toBe("tight");
  });

  it("spawnGate emits matching hazard parameters", () => {
    const def = levelById(7)!;
    const spec = spawnGate(def, seqRng([0.5, 0.0, 0.0, 0.5, 0.5]));
    expect(["static", "moving", "tight", "drift", "spike"]).toContain(spec.hazard);
    if (spec.hazard === "moving") expect(spec.omega).toBeGreaterThan(0);
    if (spec.hazard === "spike") expect(spec.spikes).toBe(true);
  });
});

describe("gate motion", () => {
  it("static gates remain at base", () => {
    const def = levelById(1)!;
    const spec = spawnGate(def, seqRng([0.5, 0.99]));
    expect(gateGapY(spec, 0, 0.7)).toBeCloseTo(0, 5);
  });

  it("moving gates oscillate around the base", () => {
    const def = levelById(5)!;
    const spec = {
      hazard: "moving" as const,
      gapY: 0,
      amplitude: 1,
      omega: Math.PI,
      shiftDir: 0,
      spikes: false,
    };
    expect(gateGapY(spec, 0, 0.5)).toBeCloseTo(1, 4);
    expect(gateGapY(spec, 0, 1)).toBeCloseTo(0, 4);
  });

  it("shifter gates slowly ramp toward direction", () => {
    const spec = {
      hazard: "shifter" as const,
      gapY: 0,
      amplitude: 0.6,
      omega: 0,
      shiftDir: 1,
      spikes: false,
    };
    expect(gateGapY(spec, 0, 0)).toBe(0);
    expect(gateGapY(spec, 0, 0.5)).toBeGreaterThan(0);
    expect(gateGapY(spec, 0, 5)).toBeCloseTo(0.6, 5);
  });

  it("tight gates narrow the playable gap", () => {
    const tight = { hazard: "tight" as const, gapY: 0, amplitude: 0, omega: 0, shiftDir: 0, spikes: false };
    expect(gateGapSize(tight, 2.85)).toBeLessThan(2.85);
    const stat = { hazard: "static" as const, gapY: 0, amplitude: 0, omega: 0, shiftDir: 0, spikes: false };
    expect(gateGapSize(stat, 2.85)).toBe(2.85);
  });
});

describe("run state", () => {
  it("counts gates and reports cleared at goal", () => {
    let s = startRun(2);
    expect(s.goal).toBe(LEVELS[1]!.goalGates);
    for (let i = 0; i < s.goal; i++) s = passGate(s);
    expect(s.cleared).toBe(true);
    expect(progressLabel(s)).toBe(`${s.goal}/${s.goal}`);
  });

  it("ignores extra gates after clear", () => {
    let s = startRun(1);
    for (let i = 0; i < s.goal + 5; i++) s = passGate(s);
    expect(s.gatesPassed).toBe(s.goal);
  });

  it("failRun freezes progress", () => {
    const s0 = startRun(3);
    const s1 = passGate(passGate(s0));
    const s2 = failRun(s1);
    expect(s2.failed).toBe(true);
    expect(s2.gatesPassed).toBe(2);
    expect(passGate(s2)).toBe(s2);
  });

  it("does not fail after a clear", () => {
    let s = startRun(1);
    for (let i = 0; i < s.goal; i++) s = passGate(s);
    const s2 = failRun(s);
    expect(s2).toBe(s);
  });
});

describe("persistence", () => {
  it("unlock starts at 1 and grows monotonically", () => {
    const st = memStorage();
    expect(readUnlocked(st)).toBe(1);
    expect(unlockNext(st, 1)).toBe(2);
    expect(unlockNext(st, 1)).toBe(2);
    expect(unlockNext(st, 5)).toBe(6);
    writeUnlocked(st, 99);
    expect(readUnlocked(st)).toBe(10);
  });

  it("best per level survives JSON roundtrip", () => {
    const st = memStorage();
    expect(readBest(st)).toEqual({});
    recordBest(st, 1, 12);
    recordBest(st, 1, 9);
    recordBest(st, 3, 7);
    expect(readBest(st)).toEqual({ 1: 12, 3: 7 });
  });

  it("recovers from legacy single-number best storage", () => {
    const st = memStorage();
    st.setItem("microgames.skyHopper.best", "21");
    expect(readBest(st)).toEqual({ 1: 21 });
  });

  it("ignores corrupted best payload", () => {
    const st = memStorage();
    st.setItem("microgames.skyHopper.best", "{not-json");
    expect(readBest(st)).toEqual({});
    writeBest(st, { 2: 10 });
    expect(readBest(st)).toEqual({ 2: 10 });
  });
});
