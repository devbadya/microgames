import { describe, expect, test } from "vitest";
import {
  LEVELS,
  activeWidth,
  applyClear,
  buildGarbage,
  clampLevel,
  creditLines,
  dropIntervalForLines,
  emptyBoard,
  failRun,
  levelById,
  pickPiece,
  pointsForLines,
  pushGarbageRow,
  readBest,
  readUnlocked,
  recordBest,
  shouldAddGarbage,
  startRun,
  unlockNext,
  writeBest,
  writeUnlocked,
  type StorageLike,
} from "./tetris-logic";

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

describe("tetris levels", () => {
  test("10 monotonically harder levels", () => {
    expect(LEVELS.length).toBe(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.dropInterval).toBeLessThanOrEqual(LEVELS[i - 1]!.dropInterval);
    }
    expect(LEVELS[0]!.id).toBe(1);
    expect(LEVELS.at(-1)!.id).toBe(10);
  });

  test("clampLevel keeps ids inside the campaign", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(11)).toBe(10);
    expect(clampLevel(Number.NaN)).toBe(1);
  });

  test("levelById returns the matching def", () => {
    expect(levelById(8)?.modifier).toBe("tetrisOnly");
    expect(levelById(99)).toBeUndefined();
  });
});

describe("scoring + speed", () => {
  test("pointsForLines scales with level and clear count", () => {
    expect(pointsForLines(1, 1)).toBe(100);
    expect(pointsForLines(4, 2)).toBe(1600);
    expect(pointsForLines(0, 5)).toBe(0);
  });

  test("dropIntervalForLines saturates at minimum", () => {
    const def = levelById(1)!;
    expect(dropIntervalForLines(def, 0)).toBeCloseTo(def.dropInterval, 5);
    expect(dropIntervalForLines(def, 10_000)).toBeCloseTo(def.minDropInterval, 5);
  });
});

describe("board builders", () => {
  test("emptyBoard has correct shape", () => {
    const b = emptyBoard(3, 4);
    expect(b.length).toBe(3);
    expect(b[0]!.length).toBe(4);
    expect(b.every((row) => row.every((c) => c === null))).toBe(true);
  });

  test("buildGarbage leaves exactly one hole per garbage row", () => {
    const b = buildGarbage(20, 10, 4, seqRng([0.05, 0.5, 0.99, 0.3]));
    let totalEmpty = 0;
    for (let y = 16; y < 20; y++) {
      const row = b[y]!;
      const empty = row.filter((c) => c === null).length;
      expect(empty).toBe(1);
      totalEmpty += empty;
    }
    expect(totalEmpty).toBe(4);
  });

  test("pushGarbageRow trims top row and adds bottom row", () => {
    const b = emptyBoard(20, 10);
    b[0]![0] = "I";
    const next = pushGarbageRow(b, seqRng([0.0]));
    expect(next.length).toBe(20);
    expect(next[0]![0]).toBeNull();
    expect(next[19]!.filter((c) => c === null).length).toBe(1);
  });
});

describe("modifier helpers", () => {
  test("shouldAddGarbage triggers on rolling-garbage levels", () => {
    const def = levelById(5)!;
    expect(shouldAddGarbage(def, 0)).toBe(false);
    expect(shouldAddGarbage(def, 4)).toBe(true);
    expect(shouldAddGarbage(def, 5)).toBe(false);
  });

  test("activeWidth narrows on narrowing levels", () => {
    const def = levelById(6)!;
    expect(activeWidth(def, 0, 10)).toBe(10);
    expect(activeWidth(def, 5, 10)).toBe(9);
    expect(activeWidth(def, 100, 10)).toBe(6);
  });

  test("creditLines requires Tetris on tetrisOnly", () => {
    const def = levelById(8)!;
    expect(creditLines(def, 1)).toBe(0);
    expect(creditLines(def, 4)).toBe(4);
  });

  test("pickPiece sparingly returns I on I-drought levels", () => {
    const def = levelById(7)!;
    const sparse = pickPiece(def, seqRng([0.99, 0.0]));
    expect(sparse).not.toBe("I");
    const lucky = pickPiece(def, seqRng([0.01]));
    expect(lucky).toBe("I");
  });
});

describe("run state", () => {
  test("applyClear adds credited lines and score", () => {
    const def = levelById(1)!;
    const s = applyClear(startRun(1), def, 4);
    expect(s.linesCredited).toBe(4);
    expect(s.totalLines).toBe(4);
    expect(s.score).toBeGreaterThan(0);
  });

  test("clears on tetrisOnly only credit Tetris hits", () => {
    const def = levelById(8)!;
    let s = applyClear(startRun(8), def, 1);
    expect(s.linesCredited).toBe(0);
    s = applyClear(s, def, 4);
    expect(s.linesCredited).toBe(4);
  });

  test("reaching goal sets cleared", () => {
    const def = levelById(1)!;
    let s = startRun(1);
    while (!s.cleared) s = applyClear(s, def, 1);
    expect(s.cleared).toBe(true);
  });

  test("failRun freezes progress", () => {
    const def = levelById(1)!;
    let s = applyClear(startRun(1), def, 2);
    s = failRun(s);
    expect(s.failed).toBe(true);
    expect(applyClear(s, def, 1)).toBe(s);
  });
});

describe("persistence", () => {
  test("unlock chain", () => {
    const st = memStorage();
    expect(readUnlocked(st)).toBe(1);
    expect(unlockNext(st, 1)).toBe(2);
    expect(unlockNext(st, 5)).toBe(6);
    writeUnlocked(st, 50);
    expect(readUnlocked(st)).toBe(10);
  });

  test("recordBest only keeps improvements", () => {
    const st = memStorage();
    recordBest(st, 1, 100);
    recordBest(st, 1, 50);
    recordBest(st, 2, 800);
    expect(readBest(st)).toEqual({ 1: 100, 2: 800 });
  });

  test("writeBest survives roundtrip", () => {
    const st = memStorage();
    writeBest(st, { 3: 12, 4: 200 });
    expect(readBest(st)).toEqual({ 3: 12, 4: 200 });
  });

  test("ignores corrupted JSON", () => {
    const st = memStorage();
    st.setItem("microgames.tetris.best", "{not-json");
    expect(readBest(st)).toEqual({});
  });
});
