/**
 * Pure logic for Panic Button. The runtime layer wires DOM events around it.
 *
 * Backwards-compatible exports preserve the original endless mode helpers
 * (scoreForHit, windowMsForRound, decoyChance) while adding a level-based
 * campaign with goals, modifiers and persistence.
 */

export type LevelModifier =
  | "none"
  | "bonusYellow"
  | "fakeFlash"
  | "doubleDecoy"
  | "speedRamp"
  | "shrinkingWindow"
  | "comboShield"
  | "twinTaps"
  | "blackout"
  | "stormFinale";

export interface LevelDef {
  id: number;
  name: string;
  briefing: string;
  /** Number of clean GREEN hits required to clear the level. */
  goalHits: number;
  /** Maximum allowed misses (red presses + late presses) before failure. */
  failsAllowed: number;
  /** Base reaction window in ms. */
  windowMs: number;
  /** Cap (0..1) on the chance of a red decoy. */
  decoyMax: number;
  /** Base decoy chance independent of combo. */
  decoyBase: number;
  /** Random pre-signal pause range [min,max] in ms. */
  steadyPause: [number, number];
  modifier: LevelModifier;
  palette: { go: string; trap: string };
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1,
    name: "Warm-up",
    briefing: "8 clean greens. Reds are rare.",
    goalHits: 8,
    failsAllowed: 3,
    windowMs: 480,
    decoyMax: 0.18,
    decoyBase: 0.1,
    steadyPause: [320, 880],
    modifier: "none",
    palette: { go: "#22c55e", trap: "#ef4444" },
  },
  {
    id: 2,
    name: "Yellow Hint",
    briefing: "Yellow signals add bonus points.",
    goalHits: 10,
    failsAllowed: 3,
    windowMs: 440,
    decoyMax: 0.22,
    decoyBase: 0.12,
    steadyPause: [300, 840],
    modifier: "bonusYellow",
    palette: { go: "#34d399", trap: "#f87171" },
  },
  {
    id: 3,
    name: "Fake Flash",
    briefing: "A red can flash before the real green.",
    goalHits: 12,
    failsAllowed: 3,
    windowMs: 420,
    decoyMax: 0.3,
    decoyBase: 0.16,
    steadyPause: [260, 820],
    modifier: "fakeFlash",
    palette: { go: "#22d3ee", trap: "#fb7185" },
  },
  {
    id: 4,
    name: "Double Decoy",
    briefing: "Reds may appear twice in a row.",
    goalHits: 14,
    failsAllowed: 3,
    windowMs: 400,
    decoyMax: 0.38,
    decoyBase: 0.22,
    steadyPause: [240, 760],
    modifier: "doubleDecoy",
    palette: { go: "#84cc16", trap: "#f97316" },
  },
  {
    id: 5,
    name: "Speed Ramp",
    briefing: "Window shrinks by every 4 hits.",
    goalHits: 14,
    failsAllowed: 2,
    windowMs: 380,
    decoyMax: 0.4,
    decoyBase: 0.22,
    steadyPause: [220, 720],
    modifier: "speedRamp",
    palette: { go: "#a78bfa", trap: "#f472b6" },
  },
  {
    id: 6,
    name: "Shrink Frame",
    briefing: "The window keeps tightening — every miss hurts.",
    goalHits: 16,
    failsAllowed: 2,
    windowMs: 360,
    decoyMax: 0.45,
    decoyBase: 0.25,
    steadyPause: [200, 680],
    modifier: "shrinkingWindow",
    palette: { go: "#facc15", trap: "#ef4444" },
  },
  {
    id: 7,
    name: "Combo Shield",
    briefing: "A 5-combo absorbs one red mistake.",
    goalHits: 18,
    failsAllowed: 2,
    windowMs: 340,
    decoyMax: 0.5,
    decoyBase: 0.28,
    steadyPause: [180, 640],
    modifier: "comboShield",
    palette: { go: "#5eead4", trap: "#ef4444" },
  },
  {
    id: 8,
    name: "Twin Taps",
    briefing: "Some greens demand two clean taps.",
    goalHits: 20,
    failsAllowed: 2,
    windowMs: 320,
    decoyMax: 0.55,
    decoyBase: 0.3,
    steadyPause: [160, 600],
    modifier: "twinTaps",
    palette: { go: "#38bdf8", trap: "#dc2626" },
  },
  {
    id: 9,
    name: "Blackout",
    briefing: "The pad goes dark before the green.",
    goalHits: 22,
    failsAllowed: 2,
    windowMs: 300,
    decoyMax: 0.55,
    decoyBase: 0.32,
    steadyPause: [140, 560],
    modifier: "blackout",
    palette: { go: "#a3e635", trap: "#dc2626" },
  },
  {
    id: 10,
    name: "Storm Finale",
    briefing: "Everything at once. 25 hits, no slack.",
    goalHits: 25,
    failsAllowed: 1,
    windowMs: 260,
    decoyMax: 0.6,
    decoyBase: 0.32,
    steadyPause: [120, 520],
    modifier: "stormFinale",
    palette: { go: "#fbbf24", trap: "#dc2626" },
  },
];

export function levelById(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function clampLevel(id: number): number {
  if (!Number.isFinite(id)) return 1;
  return Math.max(1, Math.min(LEVELS.length, Math.floor(id)));
}

/**
 * Original endless-mode helpers — preserved for backwards compatibility with
 * the existing unit tests and any other callers.
 */
export function scoreForHit(combo: number): number {
  return 12 + Math.min(90, combo * 6);
}

export function windowMsForRound(combo: number): number {
  return Math.max(110, 420 - Math.min(24, combo) * 12);
}

export function decoyChance(combo: number): number {
  return Math.min(0.55, 0.22 + combo * 0.02);
}

/** Score awarded for a clean GREEN hit inside a level run. */
export function levelScoreForHit(level: LevelDef, combo: number, isYellow: boolean): number {
  const base = scoreForHit(combo);
  const lvlBonus = level.id * 4;
  const yellow = isYellow ? Math.round(base * 0.6) : 0;
  return base + lvlBonus + yellow;
}

/** Combo-aware decoy probability for a level. */
export function levelDecoyChance(level: LevelDef, combo: number): number {
  const c = Math.max(0, Math.floor(combo));
  const raw = level.decoyBase + c * 0.018;
  let cap = level.decoyMax;
  if (level.modifier === "doubleDecoy") cap = Math.min(0.7, cap + 0.08);
  if (level.modifier === "stormFinale") cap = Math.min(0.7, cap + 0.05);
  return Math.min(cap, raw);
}

/** Reaction window after applying level modifiers. */
export function levelWindowMs(level: LevelDef, combo: number, hitsCleared: number): number {
  let win = level.windowMs;
  if (level.modifier === "speedRamp") {
    const tier = Math.floor(hitsCleared / 4);
    win -= tier * 18;
  }
  if (level.modifier === "shrinkingWindow") {
    win -= Math.min(120, hitsCleared * 6);
  }
  if (level.modifier === "stormFinale") {
    win -= Math.min(80, hitsCleared * 3);
  }
  win -= Math.min(70, combo * 4);
  return Math.max(110, Math.round(win));
}

/** Random pause before the next signal. */
export function levelSteadyPause(level: LevelDef, rng: () => number): number {
  const [lo, hi] = level.steadyPause;
  return Math.round(lo + rng() * Math.max(0, hi - lo));
}

export type SignalKind = "green" | "yellow" | "red" | "doubleRed" | "blackout";

/** Decides the next signal kind for a level given combo + RNG. */
export function nextSignal(level: LevelDef, combo: number, hitsCleared: number, rng: () => number): SignalKind {
  const decoy = levelDecoyChance(level, combo);
  const r = rng();
  if (level.modifier === "blackout" && rng() < 0.18) return "blackout";
  if (r < decoy) {
    if (level.modifier === "doubleDecoy" && rng() < 0.35) return "doubleRed";
    return "red";
  }
  if (level.modifier === "bonusYellow" && rng() < 0.22) return "yellow";
  if (level.modifier === "stormFinale" && rng() < 0.25 && hitsCleared > 4) return "yellow";
  return "green";
}

export interface RunState {
  level: number;
  hits: number;
  combo: number;
  fails: number;
  shieldsUsed: number;
  score: number;
  goal: number;
  failBudget: number;
  cleared: boolean;
  failed: boolean;
}

export function startRun(level: number): RunState {
  const def = levelById(clampLevel(level))!;
  return {
    level: def.id,
    hits: 0,
    combo: 0,
    fails: 0,
    shieldsUsed: 0,
    score: 0,
    goal: def.goalHits,
    failBudget: def.failsAllowed,
    cleared: false,
    failed: false,
  };
}

export function applyHit(state: RunState, signal: SignalKind, level: LevelDef): RunState {
  if (state.cleared || state.failed) return state;
  const isYellow = signal === "yellow";
  const score = state.score + levelScoreForHit(level, state.combo, isYellow);
  const hits = state.hits + 1;
  const cleared = hits >= state.goal;
  return {
    ...state,
    hits,
    combo: state.combo + 1,
    score,
    cleared,
  };
}

export function applyMiss(state: RunState, level: LevelDef, kind: "red" | "late"): RunState {
  if (state.cleared || state.failed) return state;
  // Combo shield absorbs ONE red press per run when combo >= 5.
  if (
    kind === "red" &&
    level.modifier === "comboShield" &&
    state.combo >= 5 &&
    state.shieldsUsed === 0
  ) {
    return { ...state, combo: 0, shieldsUsed: 1 };
  }
  const fails = state.fails + 1;
  const failed = fails > state.failBudget;
  return {
    ...state,
    combo: 0,
    fails,
    failed,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const UNLOCK_KEY = "microgames.panic.unlocked";
const BEST_KEY = "microgames.panic.best";

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
        if (Number.isFinite(id) && Number.isFinite(score) && score >= 0) out[id] = score;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function writeBest(storage: StorageLike, map: BestMap): void {
  storage.setItem(BEST_KEY, JSON.stringify(map));
}

export function recordBest(storage: StorageLike, level: number, score: number): BestMap {
  const lvl = clampLevel(level);
  const map = readBest(storage);
  if ((map[lvl] ?? 0) < score) {
    map[lvl] = score;
    writeBest(storage, map);
  }
  return map;
}
