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
