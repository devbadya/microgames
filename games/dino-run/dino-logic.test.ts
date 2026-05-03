import { describe, expect, it } from "vitest";
import {
  createDinoState,
  DESIGN,
  maxObstacleRight,
  minGapForSpeed,
  obstacleBox,
  playerBox,
  rectsOverlap,
  speedForScore,
  startRun,
  tickDino,
  type CactusOb,
  type DinoState,
} from "./dino-logic";

describe("rectsOverlap", () => {
  it("detects overlap", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it("returns false when separated", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
  });
  it("detects edge touch as overlap", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 4, h: 4 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 0, w: 4, h: 4 })).toBe(true);
  });
});

describe("playerBox", () => {
  it("uses stand hitbox when not ducking", () => {
    const b = playerBox(100, false);
    expect(b.w).toBe(DESIGN.STAND.w);
    expect(b.h).toBe(DESIGN.STAND.h);
    expect(b.y).toBe(100);
  });
  it("uses duck hitbox when ducking", () => {
    const b = playerBox(100, true);
    expect(b.h).toBe(DESIGN.DUCK.h);
    expect(b.y).toBe(100 + DESIGN.STAND.h - DESIGN.DUCK.h);
  });
});

describe("obstacleBox", () => {
  it("places cactus on ground", () => {
    const c: CactusOb = { kind: "cactus", id: 1, x: 50, w: 20, h: 50, scored: false };
    const b = obstacleBox(c, DESIGN.GROUND_Y);
    expect(b.y).toBe(DESIGN.GROUND_Y - 50);
    expect(b.x).toBe(50);
  });
  it("uses bird yTop", () => {
    const b = obstacleBox(
      { kind: "bird", id: 2, x: 10, yTop: 120, w: 40, h: 20, scored: false },
      DESIGN.GROUND_Y,
    );
    expect(b.y).toBe(120);
  });
});

describe("speedForScore", () => {
  it("ramps with score and caps", () => {
    expect(speedForScore(0)).toBe(250);
    expect(speedForScore(0)).toBeLessThan(320);
    expect(speedForScore(2000)).toBe(700);
  });
  it("is monotonic", () => {
    expect(speedForScore(3)).toBeGreaterThanOrEqual(speedForScore(2));
  });
  it("picks up after late-game threshold", () => {
    const before = speedForScore(50) - speedForScore(49);
    const after = speedForScore(52) - speedForScore(51);
    expect(after).toBeGreaterThan(before);
  });
});

describe("maxObstacleRight", () => {
  it("returns -Infinity for empty list", () => {
    expect(maxObstacleRight([])).toBe(-Infinity);
  });
  it("returns max right edge", () => {
    const a: CactusOb = { kind: "cactus", id: 1, x: 10, w: 30, h: 40, scored: false };
    const b: CactusOb = { kind: "cactus", id: 2, x: 100, w: 20, h: 40, scored: false };
    expect(maxObstacleRight([a, b])).toBe(120);
  });
});

describe("minGapForSpeed", () => {
  it("increases with speed", () => {
    expect(minGapForSpeed(300)).toBeLessThan(minGapForSpeed(600));
  });
  it("adds more space at few points (easier start)", () => {
    expect(minGapForSpeed(300, 0)).toBeGreaterThan(minGapForSpeed(300, 40));
  });
});

describe("tickDino", () => {
  const alwaysCactus: () => number = () => 0.1;

  function running(): DinoState {
    return startRun(createDinoState(0));
  }

  it("ignores tick when not running", () => {
    const idle = createDinoState(0);
    const next = tickDino(idle, 0.016, { wantJump: true, duck: false }, alwaysCactus);
    expect(next.phase).toBe("idle");
  });

  it("moves obstacles left", () => {
    let s = running();
    s = {
      ...s,
      obstacles: [{ kind: "cactus", id: 1, x: 400, w: 20, h: 50, scored: false }],
      spawnAcc: 1,
      nextSpawnIn: 99,
    };
    s = tickDino(s, 0.05, { wantJump: false, duck: false }, alwaysCactus);
    expect(s.obstacles[0]!.x).toBeLessThan(400);
  });

  it("ends run on collision", () => {
    let s = running();
    const p = playerBox(s.playerTop, false);
    s = {
      ...s,
      obstacles: [
        {
          kind: "cactus",
          id: 1,
          x: p.x - 2,
          w: p.w + 8,
          h: DESIGN.GROUND_Y - p.y,
          scored: false,
        },
      ],
      spawnAcc: 1,
      nextSpawnIn: 99,
    };
    s = tickDino(s, 0.01, { wantJump: false, duck: false }, alwaysCactus);
    expect(s.phase).toBe("dead");
    expect(s.best).toBeGreaterThanOrEqual(0);
  });

  it("jumps when grounded and not ducking", () => {
    let s = running();
    s = tickDino(s, 0.016, { wantJump: true, duck: false }, alwaysCactus);
    expect(s.grounded).toBe(false);
    expect(s.vy).toBeLessThan(0);
  });

  it("does not jump while ducking", () => {
    let s = running();
    s = tickDino(s, 0.016, { wantJump: true, duck: true }, alwaysCactus);
    expect(s.grounded).toBe(true);
  });

  it("increments score when obstacle passes player", () => {
    let s = running();
    s = {
      ...s,
      obstacles: [
        { kind: "cactus", id: 1, x: 50, w: 12, h: 50, scored: false },
      ],
      spawnAcc: 1,
      nextSpawnIn: 99,
    };
    s = tickDino(s, 0.02, { wantJump: false, duck: false }, alwaysCactus);
    expect(s.score).toBeGreaterThan(0);
  });
});

describe("startRun and createDinoState", () => {
  it("starts with running phase", () => {
    const s = startRun(createDinoState(5));
    expect(s.phase).toBe("running");
    expect(s.score).toBe(0);
    expect(s.best).toBe(5);
  });
});

import {
  DINO_LEVELS,
  applyDinoHit,
  applyDinoScore,
  clampDinoLevel,
  dinoLevelById,
  levelMinGap,
  levelSpeed,
  readDinoBest,
  readDinoUnlocked,
  recordDinoBest,
  startLevelRun,
  unlockNextDinoLevel,
  writeDinoBest,
  writeDinoUnlocked,
  type StorageLike,
} from "./dino-logic";

function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("dino campaign levels", () => {
  it("ships 10 monotonically harder levels", () => {
    expect(DINO_LEVELS.length).toBe(10);
    for (let i = 1; i < DINO_LEVELS.length; i++) {
      expect(DINO_LEVELS[i]!.speedFactor).toBeGreaterThanOrEqual(DINO_LEVELS[i - 1]!.speedFactor - 0.001);
      expect(DINO_LEVELS[i]!.goalScore).toBeGreaterThanOrEqual(DINO_LEVELS[i - 1]!.goalScore);
    }
    expect(DINO_LEVELS[0]!.id).toBe(1);
    expect(DINO_LEVELS.at(-1)!.id).toBe(10);
  });

  it("clampDinoLevel keeps ids inside the campaign", () => {
    expect(clampDinoLevel(0)).toBe(1);
    expect(clampDinoLevel(11)).toBe(10);
    expect(clampDinoLevel(Number.NaN)).toBe(1);
  });

  it("dinoLevelById returns the matching level", () => {
    expect(dinoLevelById(7)?.modifier).toBe("fastBirds");
    expect(dinoLevelById(99)).toBeUndefined();
  });

  it("levelSpeed scales base by levelFactor", () => {
    const def = dinoLevelById(2)!;
    expect(levelSpeed(def, 0)).toBeGreaterThan(speedForScore(0) - 0.001);
  });

  it("levelMinGap honours gap factor", () => {
    const easy = dinoLevelById(1)!;
    const tight = dinoLevelById(8)!;
    expect(levelMinGap(easy, 5)).toBeGreaterThan(levelMinGap(tight, 5));
  });
});

describe("dino level run state", () => {
  it("scores up to goal sets cleared", () => {
    const def = dinoLevelById(1)!;
    let s = startLevelRun(def.id);
    s = applyDinoScore(s, def.goalScore);
    expect(s.cleared).toBe(true);
  });

  it("ignores backwards score updates", () => {
    let s = startLevelRun(2);
    s = applyDinoScore(s, 5);
    const same = applyDinoScore(s, 3);
    expect(same).toBe(s);
  });

  it("hp depletes on hit and fails at zero", () => {
    let s = startLevelRun(1); // hp 1
    s = applyDinoHit(s);
    expect(s.failed).toBe(true);
    expect(s.hp).toBe(0);
  });

  it("multi-hp levels survive one hit", () => {
    let s = startLevelRun(5); // hp 2
    s = applyDinoHit(s);
    expect(s.failed).toBe(false);
    s = applyDinoHit(s);
    expect(s.failed).toBe(true);
  });
});

describe("dino persistence", () => {
  it("unlock chain", () => {
    const st = memStorage();
    expect(readDinoUnlocked(st)).toBe(1);
    expect(unlockNextDinoLevel(st, 1)).toBe(2);
    expect(unlockNextDinoLevel(st, 5)).toBe(6);
    writeDinoUnlocked(st, 50);
    expect(readDinoUnlocked(st)).toBe(10);
  });

  it("recordDinoBest only keeps improvements", () => {
    const st = memStorage();
    recordDinoBest(st, 1, 12);
    recordDinoBest(st, 1, 5);
    recordDinoBest(st, 2, 20);
    expect(readDinoBest(st)).toEqual({ 1: 12, 2: 20 });
  });

  it("ignores corrupted JSON", () => {
    const st = memStorage();
    st.setItem("microgames.dinoRun.best", "{not-json");
    expect(readDinoBest(st)).toEqual({});
  });

  it("writeDinoBest survives roundtrip", () => {
    const st = memStorage();
    writeDinoBest(st, { 3: 12, 4: 200 });
    expect(readDinoBest(st)).toEqual({ 3: 12, 4: 200 });
  });
});
