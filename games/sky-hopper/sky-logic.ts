/**
 * Pure logic for the Sky Hopper campaign.
 *
 * The runtime owns rendering, audio and engine integration. Everything that
 * needs to be unit-tested — level definitions, gate placement, hazard spawn
 * rules and progression bookkeeping — lives in this module so it can be
 * exercised without a browser context.
 */

export type HazardKind =
  | "static"
  | "moving"
  | "tight"
  | "drift"
  | "spike"
  | "shifter";

export interface LevelDef {
  /** 1-based level id. */
  id: number;
  /** Player-facing name. */
  name: string;
  /** Short briefing line. */
  briefing: string;
  /** Number of gates the player must pass to clear the level. */
  goalGates: number;
  /** Horizontal pipe speed (world units per second). */
  pipeSpeed: number;
  /** Distance between consecutive gates (world units). */
  pipeSpacing: number;
  /** Vertical opening between top and bottom pipes. */
  pipeGap: number;
  /** Gravity acting on the bird (negative = down). */
  gravity: number;
  /** Velocity applied on each flap. */
  flapVelocity: number;
  /** Possible hazards selectable for gates inside this level. */
  hazards: HazardKind[];
  /** Probability (0..1) that a spawned gate carries a non-static hazard. */
  hazardChance: number;
  /** Sky / accent hex pair used for theming. */
  palette: { sky: string; accent: string };
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1,
    name: "First Light",
    briefing: "Pass 6 gates to leave the nest.",
    goalGates: 6,
    pipeSpeed: 2.6,
    pipeSpacing: 5.6,
    pipeGap: 3.2,
    gravity: -19,
    flapVelocity: 6.8,
    hazards: ["static"],
    hazardChance: 0,
    palette: { sky: "#0c1428", accent: "#6ee7ff" },
  },
  {
    id: 2,
    name: "Morning Drift",
    briefing: "Gates start to wander — read the air.",
    goalGates: 8,
    pipeSpeed: 2.85,
    pipeSpacing: 5.4,
    pipeGap: 3.05,
    gravity: -19.5,
    flapVelocity: 6.95,
    hazards: ["static", "drift"],
    hazardChance: 0.35,
    palette: { sky: "#101a30", accent: "#7ddfff" },
  },
  {
    id: 3,
    name: "Tight Fences",
    briefing: "Narrower gaps — flap with intent.",
    goalGates: 10,
    pipeSpeed: 3.05,
    pipeSpacing: 5.2,
    pipeGap: 2.85,
    gravity: -20,
    flapVelocity: 7.05,
    hazards: ["static", "tight"],
    hazardChance: 0.45,
    palette: { sky: "#0d1c2c", accent: "#9ad7ff" },
  },
  {
    id: 4,
    name: "Slow Wave",
    briefing: "Gates rise and fall — time the flap.",
    goalGates: 12,
    pipeSpeed: 3.15,
    pipeSpacing: 5.05,
    pipeGap: 2.85,
    gravity: -20.5,
    flapVelocity: 7.1,
    hazards: ["static", "drift", "moving"],
    hazardChance: 0.55,
    palette: { sky: "#13243d", accent: "#a5f0ff" },
  },
  {
    id: 5,
    name: "Spire Belt",
    briefing: "Spike caps appear — keep clear of the centre line.",
    goalGates: 14,
    pipeSpeed: 3.3,
    pipeSpacing: 4.95,
    pipeGap: 2.8,
    gravity: -21,
    flapVelocity: 7.2,
    hazards: ["static", "moving", "spike"],
    hazardChance: 0.6,
    palette: { sky: "#15233a", accent: "#ffb7d4" },
  },
  {
    id: 6,
    name: "Shift Wind",
    briefing: "Gates shift between halves — pick your line.",
    goalGates: 14,
    pipeSpeed: 3.45,
    pipeSpacing: 4.8,
    pipeGap: 2.75,
    gravity: -21.4,
    flapVelocity: 7.25,
    hazards: ["static", "moving", "shifter"],
    hazardChance: 0.65,
    palette: { sky: "#1c1840", accent: "#b5a8ff" },
  },
  {
    id: 7,
    name: "Storm Front",
    briefing: "Faster sweeps and tighter gaps.",
    goalGates: 16,
    pipeSpeed: 3.6,
    pipeSpacing: 4.7,
    pipeGap: 2.7,
    gravity: -21.8,
    flapVelocity: 7.3,
    hazards: ["moving", "tight", "drift", "spike"],
    hazardChance: 0.75,
    palette: { sky: "#1f1638", accent: "#ff8fb1" },
  },
  {
    id: 8,
    name: "Vertical Stack",
    briefing: "Gates stack high then low — track the gap.",
    goalGates: 18,
    pipeSpeed: 3.75,
    pipeSpacing: 4.6,
    pipeGap: 2.65,
    gravity: -22.2,
    flapVelocity: 7.4,
    hazards: ["moving", "shifter", "spike"],
    hazardChance: 0.8,
    palette: { sky: "#221329", accent: "#ffb37c" },
  },
  {
    id: 9,
    name: "Razor Run",
    briefing: "Razor-thin gaps — every flap counts.",
    goalGates: 20,
    pipeSpeed: 3.95,
    pipeSpacing: 4.5,
    pipeGap: 2.55,
    gravity: -22.6,
    flapVelocity: 7.5,
    hazards: ["tight", "spike", "shifter"],
    hazardChance: 0.85,
    palette: { sky: "#190b1a", accent: "#ff6f8b" },
  },
  {
    id: 10,
    name: "Storm King",
    briefing: "Endless tempo, every hazard — finish 24 gates.",
    goalGates: 24,
    pipeSpeed: 4.15,
    pipeSpacing: 4.4,
    pipeGap: 2.5,
    gravity: -23,
    flapVelocity: 7.55,
    hazards: ["moving", "tight", "drift", "spike", "shifter"],
    hazardChance: 1,
    palette: { sky: "#0a0a14", accent: "#ffd56e" },
  },
];

export function levelById(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function clampLevel(id: number): number {
  if (!Number.isFinite(id)) return 1;
  return Math.max(1, Math.min(LEVELS.length, Math.floor(id)));
}

export interface GateSpec {
  gapY: number;
  hazard: HazardKind;
  /** For hazard "moving"/"drift": amplitude in world units. */
  amplitude: number;
  /** For hazard "moving"/"drift": angular speed (rad/s). */
  omega: number;
  /** For hazard "shifter": signed direction the gap will shift toward (0 if unused). */
  shiftDir: number;
  /** For hazard "spike": indicates spikes attached to the gate caps. */
  spikes: boolean;
}

export interface RngLike {
  (): number;
}

export function pickHazard(level: LevelDef, rng: RngLike): HazardKind {
  if (level.hazardChance <= 0) return "static";
  const variants = level.hazards.filter((h) => h !== "static");
  if (variants.length === 0) return "static";
  if (rng() > level.hazardChance) return "static";
  const idx = Math.min(variants.length - 1, Math.floor(rng() * variants.length));
  return variants[idx]!;
}

export function spawnGate(level: LevelDef, rng: RngLike, fieldHeight = 4.0): GateSpec {
  const halfRange = fieldHeight / 2 - level.pipeGap / 2 - 0.15;
  const gapY = (rng() * 2 - 1) * Math.max(0.4, halfRange);
  const hazard = pickHazard(level, rng);
  let amplitude = 0;
  let omega = 0;
  let shiftDir = 0;
  let spikes = false;
  switch (hazard) {
    case "moving":
      amplitude = 0.55 + rng() * 0.65;
      omega = 1.4 + rng() * 1.8;
      break;
    case "drift":
      amplitude = 0.3 + rng() * 0.5;
      omega = 0.8 + rng() * 1.2;
      break;
    case "tight":
      break;
    case "spike":
      spikes = true;
      break;
    case "shifter":
      shiftDir = rng() < 0.5 ? -1 : 1;
      amplitude = 0.6;
      omega = 0;
      break;
    case "static":
      break;
  }
  return { gapY, hazard, amplitude, omega, shiftDir, spikes };
}

/**
 * Live gap centre Y for a gate, given local time since the gate appeared on
 * screen. Static and tight gates do not move.
 */
export function gateGapY(spec: GateSpec, baseY: number, t: number): number {
  switch (spec.hazard) {
    case "moving":
    case "drift":
      return baseY + Math.sin(t * spec.omega) * spec.amplitude;
    case "shifter":
      // Slow ramp toward the side the gate is biased to.
      return baseY + spec.shiftDir * Math.min(spec.amplitude, t * 0.7);
    case "spike":
    case "tight":
    case "static":
    default:
      return baseY;
  }
}

/** Effective gap height (centre±half) for collision narrowing on tight gates. */
export function gateGapSize(spec: GateSpec, baseGap: number): number {
  if (spec.hazard === "tight") return Math.max(2.0, baseGap - 0.45);
  return baseGap;
}

export interface RunState {
  level: number;
  gatesPassed: number;
  goal: number;
  cleared: boolean;
  failed: boolean;
}

export function startRun(level: number): RunState {
  const def = levelById(clampLevel(level))!;
  return {
    level: def.id,
    gatesPassed: 0,
    goal: def.goalGates,
    cleared: false,
    failed: false,
  };
}

export function passGate(state: RunState): RunState {
  if (state.cleared || state.failed) return state;
  const next = state.gatesPassed + 1;
  return { ...state, gatesPassed: next, cleared: next >= state.goal };
}

export function failRun(state: RunState): RunState {
  if (state.cleared) return state;
  return { ...state, failed: true };
}

const UNLOCK_KEY = "microgames.skyHopper.unlocked";
const BEST_KEY = "microgames.skyHopper.best";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readUnlocked(storage: StorageLike): number {
  const raw = storage.getItem(UNLOCK_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return clampLevel(n);
}

export function writeUnlocked(storage: StorageLike, value: number): void {
  storage.setItem(UNLOCK_KEY, String(clampLevel(value)));
}

export function unlockNext(storage: StorageLike, justCleared: number): number {
  const cur = readUnlocked(storage);
  const next = clampLevel(Math.max(cur, justCleared + 1));
  writeUnlocked(storage, next);
  return next;
}

export interface BestMap {
  [levelId: number]: number;
}

export function readBest(storage: StorageLike): BestMap {
  const raw = storage.getItem(BEST_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: BestMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        const id = Number(k);
        const score = Number(v);
        if (Number.isFinite(id) && Number.isFinite(score) && score >= 0) {
          out[id] = score;
        }
      }
      return out;
    }
  } catch {
    /* fall through to legacy single-number form */
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return { 1: n };
  return {};
}

export function writeBest(storage: StorageLike, map: BestMap): void {
  storage.setItem(BEST_KEY, JSON.stringify(map));
}

export function recordBest(storage: StorageLike, level: number, gates: number): BestMap {
  const lvl = clampLevel(level);
  const map = readBest(storage);
  if ((map[lvl] ?? 0) < gates) {
    map[lvl] = gates;
    writeBest(storage, map);
  }
  return map;
}

/** UI helper — returns "" when goal not reached, else fully filled string. */
export function progressLabel(state: RunState): string {
  return `${state.gatesPassed}/${state.goal}`;
}
