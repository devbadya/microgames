/**
 * Pure logic helpers for the Tetris campaign. The runtime owns rendering and
 * input; the level definitions, garbage rows, scoring and persistence live
 * here so they can be exercised without a browser context.
 */

export type LevelModifier =
  | "none"
  | "fastDrop"
  | "noGhost"
  | "garbageStart"
  | "rollingGarbage"
  | "narrowing"
  | "iSparse"
  | "tetrisOnly"
  | "graviton"
  | "marathon";

export interface LevelDef {
  id: number;
  name: string;
  briefing: string;
  /** Lines required to clear the level. */
  goalLines: number;
  /** Initial drop interval in seconds. */
  dropInterval: number;
  /** Minimum drop interval in seconds (also acts as cap when scaling). */
  minDropInterval: number;
  /** Per-line acceleration factor (multiplier applied per cleared line). */
  speedMultiplier: number;
  /** Number of pre-filled garbage rows when starting the level. */
  startingGarbage: number;
  /** Garbage rows added every N cleared lines (0 = never). */
  rollingGarbageEvery: number;
  modifier: LevelModifier;
  palette: { primary: string; secondary: string };
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1,
    name: "Plumb Lines",
    briefing: "Clear 5 lines. Stay calm.",
    goalLines: 5,
    dropInterval: 0.95,
    minDropInterval: 0.55,
    speedMultiplier: 0.985,
    startingGarbage: 0,
    rollingGarbageEvery: 0,
    modifier: "none",
    palette: { primary: "#6ee7ff", secondary: "#a78bfa" },
  },
  {
    id: 2,
    name: "Faster Cadence",
    briefing: "10 lines, gravity ramps quicker.",
    goalLines: 10,
    dropInterval: 0.85,
    minDropInterval: 0.42,
    speedMultiplier: 0.97,
    startingGarbage: 0,
    rollingGarbageEvery: 0,
    modifier: "fastDrop",
    palette: { primary: "#7ddfff", secondary: "#9c8cff" },
  },
  {
    id: 3,
    name: "Ghost-less",
    briefing: "12 lines without the landing preview.",
    goalLines: 12,
    dropInterval: 0.78,
    minDropInterval: 0.4,
    speedMultiplier: 0.97,
    startingGarbage: 0,
    rollingGarbageEvery: 0,
    modifier: "noGhost",
    palette: { primary: "#9ad7ff", secondary: "#ffb37c" },
  },
  {
    id: 4,
    name: "Foundation Bricks",
    briefing: "14 lines starting from a 4-row mess.",
    goalLines: 14,
    dropInterval: 0.7,
    minDropInterval: 0.35,
    speedMultiplier: 0.965,
    startingGarbage: 4,
    rollingGarbageEvery: 0,
    modifier: "garbageStart",
    palette: { primary: "#a5f0ff", secondary: "#ffb37c" },
  },
  {
    id: 5,
    name: "Rolling Floor",
    briefing: "Garbage row every 4 cleared lines.",
    goalLines: 16,
    dropInterval: 0.62,
    minDropInterval: 0.32,
    speedMultiplier: 0.96,
    startingGarbage: 2,
    rollingGarbageEvery: 4,
    modifier: "rollingGarbage",
    palette: { primary: "#b5a8ff", secondary: "#ff8fb1" },
  },
  {
    id: 6,
    name: "Tight Frame",
    briefing: "Field narrows after every 5 lines.",
    goalLines: 18,
    dropInterval: 0.55,
    minDropInterval: 0.28,
    speedMultiplier: 0.96,
    startingGarbage: 2,
    rollingGarbageEvery: 0,
    modifier: "narrowing",
    palette: { primary: "#ff8fb1", secondary: "#ffb37c" },
  },
  {
    id: 7,
    name: "I Drought",
    briefing: "I-pieces are scarce — improvise.",
    goalLines: 20,
    dropInterval: 0.5,
    minDropInterval: 0.26,
    speedMultiplier: 0.955,
    startingGarbage: 2,
    rollingGarbageEvery: 5,
    modifier: "iSparse",
    palette: { primary: "#ffd56e", secondary: "#ff7ca8" },
  },
  {
    id: 8,
    name: "Tetris Tax",
    briefing: "Only Tetris (4-line) clears count.",
    goalLines: 8,
    dropInterval: 0.5,
    minDropInterval: 0.28,
    speedMultiplier: 0.96,
    startingGarbage: 0,
    rollingGarbageEvery: 0,
    modifier: "tetrisOnly",
    palette: { primary: "#5ce7a8", secondary: "#6ee7ff" },
  },
  {
    id: 9,
    name: "Graviton",
    briefing: "Floor gravity pulls hangers down on every clear.",
    goalLines: 20,
    dropInterval: 0.42,
    minDropInterval: 0.22,
    speedMultiplier: 0.95,
    startingGarbage: 3,
    rollingGarbageEvery: 6,
    modifier: "graviton",
    palette: { primary: "#a78bfa", secondary: "#ff7ca8" },
  },
  {
    id: 10,
    name: "Marathon",
    briefing: "30 lines, max gravity, no slack.",
    goalLines: 30,
    dropInterval: 0.36,
    minDropInterval: 0.16,
    speedMultiplier: 0.95,
    startingGarbage: 4,
    rollingGarbageEvery: 4,
    modifier: "marathon",
    palette: { primary: "#ff7ca8", secondary: "#ffd56e" },
  },
];

export function levelById(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function clampLevel(id: number): number {
  if (!Number.isFinite(id)) return 1;
  return Math.max(1, Math.min(LEVELS.length, Math.floor(id)));
}

const LINE_POINTS: readonly number[] = [0, 100, 300, 500, 800];

export function pointsForLines(cleared: number, level: number): number {
  const idx = Math.max(0, Math.min(LINE_POINTS.length - 1, cleared));
  const base = LINE_POINTS[idx]!;
  return base * Math.max(1, level);
}

export function dropIntervalForLines(level: LevelDef, linesCleared: number): number {
  const cur = level.dropInterval * Math.pow(level.speedMultiplier, linesCleared);
  return Math.max(level.minDropInterval, cur);
}

export function shouldAddGarbage(level: LevelDef, linesClearedTotal: number): boolean {
  if (level.rollingGarbageEvery <= 0) return false;
  if (linesClearedTotal === 0) return false;
  return linesClearedTotal % level.rollingGarbageEvery === 0;
}

export function activeWidth(level: LevelDef, linesClearedTotal: number, fullCols: number): number {
  if (level.modifier !== "narrowing") return fullCols;
  const tier = Math.floor(linesClearedTotal / 5);
  return Math.max(6, fullCols - Math.min(4, tier));
}

/** Counts a clear toward the goal. Tetris-only levels only credit 4-line clears. */
export function creditLines(level: LevelDef, cleared: number): number {
  if (cleared <= 0) return 0;
  if (level.modifier === "tetrisOnly") return cleared >= 4 ? cleared : 0;
  return cleared;
}

export type PieceKey = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_KEYS: readonly PieceKey[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Picks a piece using level-aware probabilities (e.g. I-drought modifier). */
export function pickPiece(level: LevelDef, rng: () => number): PieceKey {
  if (level.modifier === "iSparse") {
    if (rng() < 0.06) return "I";
    const others = PIECE_KEYS.filter((k) => k !== "I");
    return others[Math.floor(rng() * others.length) % others.length]!;
  }
  return PIECE_KEYS[Math.floor(rng() * PIECE_KEYS.length) % PIECE_KEYS.length]!;
}

export type Cell = PieceKey | "G" | null;
export type Board = Cell[][];

export function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null));
}

/** Generates a starting garbage stack at the bottom rows. */
export function buildGarbage(rows: number, cols: number, garbageRows: number, rng: () => number): Board {
  const board = emptyBoard(rows, cols);
  const start = rows - garbageRows;
  for (let y = start; y < rows; y++) {
    const row = board[y]!;
    const hole = Math.floor(rng() * cols);
    for (let x = 0; x < cols; x++) {
      row[x] = x === hole ? null : "G";
    }
  }
  return board;
}

/** Returns a shallow-cloned board with one new garbage row pushed in from the bottom. */
export function pushGarbageRow(board: Board, rng: () => number): Board {
  if (board.length === 0) return board;
  const cols = board[0]!.length;
  const hole = Math.floor(rng() * cols);
  const newRow: Cell[] = new Array<Cell>(cols).fill("G");
  newRow[hole] = null;
  const next = board.slice(1).concat([newRow]);
  return next;
}

export interface RunState {
  level: number;
  linesCredited: number;
  totalLines: number;
  goal: number;
  score: number;
  cleared: boolean;
  failed: boolean;
}

export function startRun(level: number): RunState {
  const def = levelById(clampLevel(level))!;
  return {
    level: def.id,
    linesCredited: 0,
    totalLines: 0,
    goal: def.goalLines,
    score: 0,
    cleared: false,
    failed: false,
  };
}

export function applyClear(state: RunState, level: LevelDef, cleared: number): RunState {
  if (state.cleared || state.failed) return state;
  const credit = creditLines(level, cleared);
  const linesCredited = state.linesCredited + credit;
  const totalLines = state.totalLines + cleared;
  const score = state.score + pointsForLines(cleared, level.id);
  return {
    ...state,
    linesCredited,
    totalLines,
    score,
    cleared: linesCredited >= state.goal,
  };
}

export function failRun(state: RunState): RunState {
  if (state.cleared) return state;
  return { ...state, failed: true };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const UNLOCK_KEY = "microgames.tetris.unlocked";
const BEST_KEY = "microgames.tetris.best";

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
