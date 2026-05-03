/**
 * Dino-style endless runner: pure simulation (testable, no DOM).
 * Canvas coords: y increases downward, ground line at GROUND_Y.
 */

export const DESIGN = {
  CANVAS_W: 800,
  CANVAS_H: 300,
  GROUND_Y: 228,
  PLAYER_X: 96,
  STAND: { w: 42, h: 46 },
  DUCK: { w: 54, h: 28 },
} as const;

export const PHYS = {
  GRAVITY: 2550,
  JUMP_V: -695,
  /** Scroll speed (px/s) at 0 and max points. */
  START_SPEED: 250,
  MAX_SPEED: 700,
  /** Base curve: gentle linear + soft sqrt ramp. */
  SPEED_LINEAR_WEIGHT: 0.95,
  SPEED_SQRT_WEIGHT: 2.5,
  /** Extra px/s per point after this many cleared obstacles (endgame pressure). */
  SPEED_LATE_START: 50,
  SPEED_LATE_PER_POINT: 0.45,
} as const;

export type Rect = { x: number; y: number; w: number; h: number };

export type CactusOb = { kind: "cactus"; id: number; x: number; w: number; h: number; scored: boolean };
export type BirdOb = { kind: "bird"; id: number; x: number; yTop: number; w: number; h: number; scored: boolean };
export type Obstacle = CactusOb | BirdOb;

export type Phase = "idle" | "running" | "dead";

export type DinoInput = {
  wantJump: boolean;
  duck: boolean;
};

export type DinoState = {
  phase: Phase;
  playerTop: number;
  vy: number;
  isDuck: boolean;
  grounded: boolean;
  speed: number;
  score: number;
  best: number;
  obstacles: Obstacle[];
  spawnAcc: number;
  nextSpawnIn: number;
  obstacleId: number;
  runTime: number;
};

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function playerBox(playerTop: number, duck: boolean): Rect {
  const { PLAYER_X, STAND, DUCK } = DESIGN;
  if (duck) {
    return { x: PLAYER_X, y: playerTop + STAND.h - DUCK.h, w: DUCK.w, h: DUCK.h };
  }
  return { x: PLAYER_X, y: playerTop, w: STAND.w, h: STAND.h };
}

export function obstacleBox(o: Obstacle, groundY: number): Rect {
  if (o.kind === "cactus") {
    return { x: o.x, y: groundY - o.h, w: o.w, h: o.h };
  }
  return { x: o.x, y: o.yTop, w: o.w, h: o.h };
}

export function speedForScore(score: number): number {
  const s = Math.floor(Math.max(0, score));
  const base =
    PHYS.START_SPEED + s * PHYS.SPEED_LINEAR_WEIGHT + PHYS.SPEED_SQRT_WEIGHT * Math.sqrt(s);
  const late =
    s > PHYS.SPEED_LATE_START ? (s - PHYS.SPEED_LATE_START) * PHYS.SPEED_LATE_PER_POINT : 0;
  return Math.min(PHYS.MAX_SPEED, base + late);
}

export function maxObstacleRight(obs: Obstacle[]): number {
  if (obs.length === 0) return -Infinity;
  return Math.max(...obs.map((o) => o.x + o.w));
}

/** Minimum horizontal gap before the next obstacle can spawn; extra room early on. */
export function minGapForSpeed(speed: number, points: number = 0): number {
  const p = Math.max(0, points);
  const earlyBonus = Math.max(0, 70 - p * 0.95);
  return 290 + speed * 0.102 + earlyBonus;
}

function spawnObstacle(
  id: number,
  groundY: number,
  rng: () => number,
  points: number,
): Obstacle {
  const diff = Math.min(1, Math.max(0, points) / 48);
  const birdRoll = 0.075 + 0.47 * diff;
  if (rng() > birdRoll) {
    const w = 16 + Math.floor(rng() * (10 + 16 * diff));
    const hMax = diff < 0.2 ? 50 : 50 + Math.floor(24 * diff);
    const h = 40 + Math.floor(rng() * (hMax - 40 + 0.0001));
    return { kind: "cactus", id, x: DESIGN.CANVAS_W + 8, w, h, scored: false };
  }
  const isLow = rng() < 0.52 + 0.1 * diff;
  const yTop = isLow
    ? groundY - 60 - Math.floor(rng() * 18)
    : groundY - 112 - Math.floor(rng() * 38);
  return {
    kind: "bird",
    id,
    x: DESIGN.CANVAS_W + 8,
    yTop,
    w: 36 + Math.floor(rng() * 8),
    h: 18 + Math.floor(rng() * 8),
    scored: false,
  };
}

function collides(p: Rect, o: Obstacle, groundY: number): boolean {
  return rectsOverlap(p, obstacleBox(o, groundY));
}

/**
 * One simulation step while `phase === "running"`.
 */
export function tickDino(
  s: DinoState,
  dt: number,
  input: DinoInput,
  rng: () => number,
  groundY: number = DESIGN.GROUND_Y,
): DinoState {
  if (s.phase !== "running") {
    return s;
  }

  const { STAND, DUCK, PLAYER_X, CANVAS_W } = DESIGN;
  const duckHolding = s.grounded && input.duck;
  const h = duckHolding ? DUCK.h : STAND.h;
  const canJump = s.grounded && !duckHolding;

  let { playerTop, vy, isDuck, grounded, score, obstacles, spawnAcc, nextSpawnIn, obstacleId, runTime } = s;
  isDuck = duckHolding;
  runTime += dt;

  if (s.grounded) {
    playerTop = groundY - h;
  }

  if (canJump && input.wantJump) {
    vy = PHYS.JUMP_V;
    grounded = false;
  }

  if (!grounded) {
    vy += PHYS.GRAVITY * dt;
    playerTop += vy * dt;
  }

  const bottom = playerTop + h;
  if (bottom >= groundY) {
    playerTop = groundY - h;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  const newSpeed = speedForScore(score);
  const intPoints = Math.floor(score);

  const moved: Obstacle[] = [];
  for (const o of obstacles) {
    const x = o.x - newSpeed * dt;
    const u = o.kind === "cactus" ? { ...o, x } : { ...o, x };
    if (u.x + u.w < -4) {
      continue;
    }
    if (!u.scored && u.x + u.w < PLAYER_X) {
      u.scored = true;
      score += 1;
    }
    moved.push(u);
  }
  obstacles = moved;

  spawnAcc += dt;
  nextSpawnIn -= dt;
  const gapOk = maxObstacleRight(obstacles) < CANVAS_W - minGapForSpeed(newSpeed, intPoints);
  const needSpawn =
    (obstacles.length === 0 && spawnAcc > 0.58) ||
    (obstacles.length > 0 && nextSpawnIn <= 0 && gapOk);
  if (needSpawn) {
    obstacleId += 1;
    obstacles = [...obstacles, spawnObstacle(obstacleId, groundY, rng, intPoints)];
    spawnAcc = 0;
    const baseDelay = 0.58 - Math.min(0.26, intPoints * 0.0065);
    nextSpawnIn = baseDelay + rng() * (0.42 - Math.min(0.14, intPoints * 0.0022));
  }

  const pRect = playerBox(playerTop, isDuck);
  for (const o of obstacles) {
    if (collides(pRect, o, groundY)) {
      const best = Math.max(s.best, Math.floor(score));
      return {
        ...s,
        phase: "dead",
        best,
        playerTop,
        vy,
        isDuck,
        grounded: true,
        speed: newSpeed,
        score,
        obstacles,
        spawnAcc,
        nextSpawnIn,
        obstacleId,
        runTime,
      };
    }
  }

  return {
    ...s,
    playerTop,
    vy,
    isDuck,
    grounded,
    speed: newSpeed,
    score,
    obstacles,
    spawnAcc,
    nextSpawnIn,
    obstacleId,
    runTime,
  };
}

export function createDinoState(best: number): DinoState {
  const ground = DESIGN.GROUND_Y;
  return {
    phase: "idle",
    playerTop: ground - DESIGN.STAND.h,
    vy: 0,
    isDuck: false,
    grounded: true,
    speed: PHYS.START_SPEED,
    score: 0,
    best,
    obstacles: [],
    spawnAcc: 0,
    nextSpawnIn: 0.15,
    obstacleId: 0,
    runTime: 0,
  };
}

export function startRun(s: DinoState): DinoState {
  return {
    ...createDinoState(s.best),
    phase: "running",
  };
}

/* ------------------------------------------------------------------------- *
 * Campaign: 10 levels with goal counts, weather and obstacle modifiers.
 *
 * The level system wraps `tickDino` via `tickLevel` so the existing physics
 * tests keep working. Levels mostly tweak speeds, spawn rules and weather;
 * the runtime renders weather + UI on top.
 * ------------------------------------------------------------------------- */

export type Weather = "clear" | "drizzle" | "fog" | "storm" | "sandstorm" | "night";
export type LevelModifier =
  | "none"
  | "speedy"
  | "moreBirds"
  | "narrowGaps"
  | "lowVisibility"
  | "windPushBack"
  | "fastBirds"
  | "doubleSpawn"
  | "ironRun"
  | "boss";

export interface DinoLevelDef {
  id: number;
  name: string;
  briefing: string;
  /** Number of obstacles the player must pass to clear the level. */
  goalScore: number;
  /** Multiplier applied to the base speed. */
  speedFactor: number;
  /** Multiplier on the minimum gap (smaller = denser). */
  gapFactor: number;
  /** Probability boost for bird obstacles. */
  birdBias: number;
  /** Hits the player can absorb before dying. */
  hp: number;
  weather: Weather;
  modifier: LevelModifier;
  palette: { sky: string; ground: string; accent: string };
}

export const DINO_LEVELS: readonly DinoLevelDef[] = [
  {
    id: 1,
    name: "First Steps",
    briefing: "Pass 12 obstacles. Single hit ends the run.",
    goalScore: 12,
    speedFactor: 0.9,
    gapFactor: 1.1,
    birdBias: 0,
    hp: 1,
    weather: "clear",
    modifier: "none",
    palette: { sky: "#0d1326", ground: "#cdb89a", accent: "#6ee7ff" },
  },
  {
    id: 2,
    name: "Quickening",
    briefing: "Pace picks up — 16 obstacles to clear.",
    goalScore: 16,
    speedFactor: 1.0,
    gapFactor: 1.0,
    birdBias: 0.05,
    hp: 1,
    weather: "clear",
    modifier: "speedy",
    palette: { sky: "#13182f", ground: "#d1bfa1", accent: "#7ddfff" },
  },
  {
    id: 3,
    name: "Skybound",
    briefing: "More birds. Duck and dive.",
    goalScore: 20,
    speedFactor: 1.05,
    gapFactor: 1.0,
    birdBias: 0.18,
    hp: 1,
    weather: "drizzle",
    modifier: "moreBirds",
    palette: { sky: "#101b32", ground: "#b9a98e", accent: "#9ad7ff" },
  },
  {
    id: 4,
    name: "Tight Spacing",
    briefing: "Obstacles huddle closer.",
    goalScore: 22,
    speedFactor: 1.05,
    gapFactor: 0.85,
    birdBias: 0.1,
    hp: 1,
    weather: "drizzle",
    modifier: "narrowGaps",
    palette: { sky: "#0e1c34", ground: "#b3a585", accent: "#a5f0ff" },
  },
  {
    id: 5,
    name: "Foggy Plains",
    briefing: "Visibility drops — train your timing.",
    goalScore: 24,
    speedFactor: 1.1,
    gapFactor: 0.95,
    birdBias: 0.12,
    hp: 2,
    weather: "fog",
    modifier: "lowVisibility",
    palette: { sky: "#1c2235", ground: "#a89a82", accent: "#cbd5ff" },
  },
  {
    id: 6,
    name: "Headwind",
    briefing: "A wind shoves you back when you fly.",
    goalScore: 26,
    speedFactor: 1.15,
    gapFactor: 0.9,
    birdBias: 0.18,
    hp: 2,
    weather: "drizzle",
    modifier: "windPushBack",
    palette: { sky: "#1a2030", ground: "#a39279", accent: "#b5a8ff" },
  },
  {
    id: 7,
    name: "Storm",
    briefing: "Faster birds, slick ground.",
    goalScore: 28,
    speedFactor: 1.2,
    gapFactor: 0.88,
    birdBias: 0.22,
    hp: 2,
    weather: "storm",
    modifier: "fastBirds",
    palette: { sky: "#1f1638", ground: "#9b8a72", accent: "#ff8fb1" },
  },
  {
    id: 8,
    name: "Sandstorm",
    briefing: "Two obstacles can spawn back-to-back.",
    goalScore: 30,
    speedFactor: 1.22,
    gapFactor: 0.85,
    birdBias: 0.15,
    hp: 2,
    weather: "sandstorm",
    modifier: "doubleSpawn",
    palette: { sky: "#291f1a", ground: "#b89a72", accent: "#ffb37c" },
  },
  {
    id: 9,
    name: "Iron Run",
    briefing: "32 obstacles. Speed maxes out.",
    goalScore: 32,
    speedFactor: 1.28,
    gapFactor: 0.82,
    birdBias: 0.2,
    hp: 3,
    weather: "night",
    modifier: "ironRun",
    palette: { sky: "#080a16", ground: "#806d52", accent: "#a78bfa" },
  },
  {
    id: 10,
    name: "Boss: Sky Tyrant",
    briefing: "Survive 40 hits while a giant raptor circles.",
    goalScore: 40,
    speedFactor: 1.3,
    gapFactor: 0.86,
    birdBias: 0.28,
    hp: 4,
    weather: "storm",
    modifier: "boss",
    palette: { sky: "#1a0d2e", ground: "#735c44", accent: "#ff6f8b" },
  },
];

export function dinoLevelById(id: number): DinoLevelDef | undefined {
  return DINO_LEVELS.find((l) => l.id === id);
}

export function clampDinoLevel(id: number): number {
  if (!Number.isFinite(id)) return 1;
  return Math.max(1, Math.min(DINO_LEVELS.length, Math.floor(id)));
}

export interface LevelRunState {
  level: number;
  hp: number;
  goal: number;
  score: number;
  cleared: boolean;
  failed: boolean;
}

export function startLevelRun(level: number): LevelRunState {
  const def = dinoLevelById(clampDinoLevel(level))!;
  return {
    level: def.id,
    hp: def.hp,
    goal: def.goalScore,
    score: 0,
    cleared: false,
    failed: false,
  };
}

export function applyDinoScore(state: LevelRunState, score: number): LevelRunState {
  if (state.cleared || state.failed) return state;
  if (score <= state.score) return state;
  const cleared = score >= state.goal;
  return { ...state, score, cleared };
}

export function applyDinoHit(state: LevelRunState): LevelRunState {
  if (state.cleared || state.failed) return state;
  const hp = state.hp - 1;
  if (hp <= 0) return { ...state, hp: 0, failed: true };
  return { ...state, hp };
}

/** Recomputes speed for a campaign tick (level multiplies the base). */
export function levelSpeed(level: DinoLevelDef, score: number): number {
  return Math.min(PHYS.MAX_SPEED, speedForScore(score) * level.speedFactor);
}

/** Re-uses minGap but adapts via level gapFactor. */
export function levelMinGap(level: DinoLevelDef, score: number): number {
  return minGapForSpeed(levelSpeed(level, score), score) * level.gapFactor;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const UNLOCK_KEY = "microgames.dinoRun.unlocked";
const BEST_KEY = "microgames.dinoRun.best";

export function readDinoUnlocked(storage: StorageLike): number {
  const raw = storage.getItem(UNLOCK_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return clampDinoLevel(n);
}

export function writeDinoUnlocked(storage: StorageLike, value: number): void {
  storage.setItem(UNLOCK_KEY, String(clampDinoLevel(value)));
}

export function unlockNextDinoLevel(storage: StorageLike, justCleared: number): number {
  const cur = readDinoUnlocked(storage);
  const next = clampDinoLevel(Math.max(cur, justCleared + 1));
  writeDinoUnlocked(storage, next);
  return next;
}

export interface DinoBestMap {
  [levelId: number]: number;
}

export function readDinoBest(storage: StorageLike): DinoBestMap {
  const raw = storage.getItem(BEST_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: DinoBestMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        const id = Number(k);
        const score = Number(v);
        if (Number.isFinite(id) && Number.isFinite(score) && score >= 0) out[id] = score;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function writeDinoBest(storage: StorageLike, map: DinoBestMap): void {
  storage.setItem(BEST_KEY, JSON.stringify(map));
}

export function recordDinoBest(storage: StorageLike, level: number, score: number): DinoBestMap {
  const lvl = clampDinoLevel(level);
  const map = readDinoBest(storage);
  if ((map[lvl] ?? 0) < score) {
    map[lvl] = score;
    writeDinoBest(storage, map);
  }
  return map;
}
