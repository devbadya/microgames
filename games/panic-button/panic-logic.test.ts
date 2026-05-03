import { describe, expect, test } from "vitest";
import {
  LEVELS,
  applyHit,
  applyMiss,
  clampLevel,
  decoyChance,
  levelById,
  levelDecoyChance,
  levelScoreForHit,
  levelSteadyPause,
  levelWindowMs,
  nextSignal,
  readBest,
  readUnlocked,
  recordBest,
  scoreForHit,
  startRun,
  unlockNext,
  windowMsForRound,
  writeBest,
  writeUnlocked,
  type StorageLike,
} from "./panic-logic";

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

describe("panic-logic legacy helpers", () => {
  test("score scales with combo", () => {
    expect(scoreForHit(0)).toBe(12);
    expect(scoreForHit(3)).toBeGreaterThan(scoreForHit(0));
  });
  test("window tightens slightly", () => {
    expect(windowMsForRound(20)).toBeLessThan(windowMsForRound(0));
  });
  test("decoy ceiling", () => {
    expect(decoyChance(100)).toBe(0.55);
  });
});

describe("panic-button levels", () => {
  test("defines 10 monotonically harder levels", () => {
    expect(LEVELS.length).toBe(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.windowMs).toBeLessThanOrEqual(LEVELS[i - 1]!.windowMs);
      expect(LEVELS[i]!.goalHits).toBeGreaterThanOrEqual(LEVELS[i - 1]!.goalHits);
    }
    expect(LEVELS[0]!.id).toBe(1);
    expect(LEVELS.at(-1)!.id).toBe(10);
  });

  test("clampLevel keeps ids inside the campaign", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(11)).toBe(10);
    expect(clampLevel(Number.NaN)).toBe(1);
  });

  test("levelById returns the matching level def", () => {
    expect(levelById(4)?.name).toBe("Double Decoy");
    expect(levelById(99)).toBeUndefined();
  });
});

describe("level signal selection", () => {
  test("returns red when decoy threshold triggered", () => {
    const def = levelById(3)!;
    expect(nextSignal(def, 0, 0, seqRng([0]))).toBe("red");
  });

  test("emits yellow on bonus levels when rolling into yellow band", () => {
    const def = levelById(2)!;
    expect(nextSignal(def, 0, 1, seqRng([0.99, 0.01]))).toBe("yellow");
  });

  test("emits doubleRed when level supports it", () => {
    const def = levelById(4)!;
    expect(nextSignal(def, 0, 0, seqRng([0, 0.01]))).toBe("doubleRed");
  });

  test("blackout level can return blackout signal", () => {
    const def = levelById(9)!;
    expect(nextSignal(def, 0, 0, seqRng([0.99, 0.0, 0.99]))).toBe("blackout");
  });

  test("decoy chance grows with combo but caps", () => {
    const def = levelById(8)!;
    expect(levelDecoyChance(def, 0)).toBeCloseTo(def.decoyBase, 5);
    expect(levelDecoyChance(def, 999)).toBeLessThanOrEqual(def.decoyMax);
  });

  test("levelSteadyPause uses configured range", () => {
    const def = levelById(1)!;
    const lo = levelSteadyPause(def, () => 0);
    const hi = levelSteadyPause(def, () => 1);
    expect(lo).toBeGreaterThanOrEqual(def.steadyPause[0]);
    expect(hi).toBeLessThanOrEqual(def.steadyPause[1]);
  });
});

describe("level window scaling", () => {
  test("speed-ramp tightens by tier", () => {
    const def = levelById(5)!;
    const w0 = levelWindowMs(def, 0, 0);
    const w8 = levelWindowMs(def, 0, 8);
    expect(w8).toBeLessThan(w0);
  });

  test("shrinking window shaves more per hit", () => {
    const def = levelById(6)!;
    const w0 = levelWindowMs(def, 0, 0);
    const w10 = levelWindowMs(def, 0, 10);
    expect(w10).toBeLessThan(w0);
  });

  test("never drops below 110ms", () => {
    const def = levelById(10)!;
    expect(levelWindowMs(def, 100, 100)).toBeGreaterThanOrEqual(110);
  });
});

describe("run state", () => {
  test("hits accumulate to clear", () => {
    let s = startRun(1);
    const def = levelById(1)!;
    while (!s.cleared) s = applyHit(s, "green", def);
    expect(s.cleared).toBe(true);
    expect(s.hits).toBe(s.goal);
  });

  test("yellow signal awards bonus score", () => {
    const def = levelById(2)!;
    const s = startRun(2);
    const greenScore = applyHit(s, "green", def).score;
    const yellowScore = applyHit(s, "yellow", def).score;
    expect(yellowScore).toBeGreaterThan(greenScore);
  });

  test("red miss increments fails and resets combo", () => {
    const def = levelById(1)!;
    const s = applyHit(startRun(1), "green", def);
    const m = applyMiss(s, def, "red");
    expect(m.combo).toBe(0);
    expect(m.fails).toBe(1);
  });

  test("combo shield absorbs first red after combo >= 5", () => {
    const def = levelById(7)!;
    let s = startRun(7);
    for (let i = 0; i < 5; i++) s = applyHit(s, "green", def);
    const after = applyMiss(s, def, "red");
    expect(after.fails).toBe(0);
    expect(after.shieldsUsed).toBe(1);
  });

  test("exceeding fail budget marks the run failed", () => {
    const def = levelById(1)!;
    let s = startRun(1);
    for (let i = 0; i <= def.failsAllowed; i++) s = applyMiss(s, def, "red");
    expect(s.failed).toBe(true);
  });

  test("score-for-hit grows with combo", () => {
    const def = levelById(3)!;
    expect(levelScoreForHit(def, 0, false)).toBeLessThan(levelScoreForHit(def, 5, false));
  });
});

describe("persistence", () => {
  test("unlock chain", () => {
    const st = memStorage();
    expect(readUnlocked(st)).toBe(1);
    expect(unlockNext(st, 1)).toBe(2);
    expect(unlockNext(st, 4)).toBe(5);
    writeUnlocked(st, 50);
    expect(readUnlocked(st)).toBe(10);
  });

  test("recordBest only stores improvements", () => {
    const st = memStorage();
    recordBest(st, 1, 50);
    recordBest(st, 1, 10);
    recordBest(st, 2, 80);
    expect(readBest(st)).toEqual({ 1: 50, 2: 80 });
  });

  test("writeBest survives roundtrip", () => {
    const st = memStorage();
    writeBest(st, { 3: 12, 4: 200 });
    expect(readBest(st)).toEqual({ 3: 12, 4: 200 });
  });

  test("ignores corrupted JSON", () => {
    const st = memStorage();
    st.setItem("microgames.panic.best", "{not-json");
    expect(readBest(st)).toEqual({});
  });
});
