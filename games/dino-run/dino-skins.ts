/**
 * Offline-runner style T‑Rex: same ASCII sprite grid + run physics as Chromium’s dinosaur,
 * tintable via two stripes (main + shaded rows).
 */

const LS_COLOR_KEY = "microgames.dinoRun.dinoColor";

/** Default close to Chromium’s dinosaur grey `#535353` (with striped shade). */
export const DEFAULT_DINO_BODY = "#535353";

export function normalizeHex(css: string): string {
  const n = css.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  if (/^#[0-9a-f]{3}$/.test(n)) {
    const inner = n.slice(1);
    const out = [...inner].map((c) => `${c}${c}`).join("");
    return `#${out}`;
  }
  return DEFAULT_DINO_BODY;
}

/** Second stripe: slightly darker rows (offline-game look when body is chrome grey). */
export function shadeFromBody(hex: string, factor = 0.72): string {
  const h = normalizeHex(hex);
  const n = parseInt(h.slice(1), 16);
  const r = Math.round(Math.min(255, Math.max(0, ((n >> 16) & 255) * factor)));
  const g = Math.round(Math.min(255, Math.max(0, ((n >> 8) & 255) * factor)));
  const b = Math.round(Math.min(255, Math.max(0, (n & 255) * factor)));
  const out = (r << 16) | (g << 8) | b;
  return `#${out.toString(16).padStart(6, "0")}`;
}

export function loadStoredDinoColor(): string {
  const raw = window.localStorage.getItem(LS_COLOR_KEY);
  if (typeof raw === "string" && raw.startsWith("#")) return normalizeHex(raw);
  return DEFAULT_DINO_BODY;
}

export function storeDinoColor(hex: string): void {
  window.localStorage.setItem(LS_COLOR_KEY, normalizeHex(hex));
}

/** Remove legacy dinosaur-pack skin preference if present (no migration of value). */
export function migrateDropPackSkinPreference(): void {
  try {
    window.localStorage.removeItem("microgames.dinoRun.skin");
  } catch {
    /* ignore */
  }
}

export type DinoSprites = {
  runFrames: readonly [readonly string[], readonly string[], readonly string[], readonly string[]];
  jump: readonly string[];
  duck0: readonly string[];
  duck1: readonly string[];
};

const RUN_0: readonly string[] = [
  ".....................",
  "...........######....",
  ".........############",
  "........#############",
  ".......##############",
  "......###############",
  ".....################",
  ".....#############...",
  ".....############....",
  ".....############....",
  "....#############....",
  "...##############....",
  "..###############....",
  ".###############.....",
  "###############......",
  "##############.......",
  "#########.###........",
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "###...........###....",
  "##.............###...",
  "...#............##...",
];

const RUN_1: readonly string[] = [
  ".....................",
  "...........######....",
  ".........############",
  "........#############",
  ".......##############",
  "......###############",
  ".....################",
  ".....#############...",
  ".....############....",
  ".....############....",
  "....#############....",
  "...##############....",
  "..###############....",
  ".###############.....",
  "###############......",
  "##############.......",
  "#########.###........",
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "##...........###.....",
  "...#............##...",
  "......#.........##...",
];

const LEGS_TRANSITION_A: readonly string[] = [
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "###..........###.....",
  "##.............###...",
  "...#............##...",
];

const LEGS_TRANSITION_B: readonly string[] = [
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "##...........###.....",
  "##.............###...",
  ".......#.........##..",
];

const RUN_PREFIX17 = RUN_0.slice(0, 17);

/** Four-frame run matching the offline game cadence — two contact poses + passing steps. */
export const OFFLINE_DINO_SPRITES: DinoSprites = {
  runFrames: [
    RUN_0,
    [...RUN_PREFIX17, ...LEGS_TRANSITION_A],
    RUN_1,
    [...RUN_PREFIX17, ...LEGS_TRANSITION_B],
  ],
  jump: [
    ".....................",
    "...........######....",
    ".........############",
    "........#############",
    ".......##############",
    "......###############",
    ".....################",
    ".....#############...",
    ".....############....",
    ".....############....",
    "....#############....",
    "...##############....",
    "..###############....",
    ".###############.....",
    "###############......",
    "##############.......",
    "#########.###........",
    "########....##.......",
    "######.......##......",
    "#####.........##.....",
    "####............#....",
    "###..............##..",
    "##................##.",
    ".....................",
  ],
  duck0: [
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "....######################..",
    "...########################.",
    "...########################.",
    "...#################.#######",
    "..###############....#######",
    ".################...########",
    "################....########",
    "###############.....########",
    "##############.....########.",
  ],
  duck1: [
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "....######################..",
    "...########################.",
    "...########################.",
    "...#################.#######",
    "..###############.....######",
    ".################.....######",
    "################......######",
    "###############.......######",
    "##############........######.",
  ],
};

export function getOfflineDinoSprites(): DinoSprites {
  return OFFLINE_DINO_SPRITES;
}

const RUN_FRAME_MS = 52;

export function stripePhaseForAlternateRows(): number {
  return 0;
}

function drawBitmapCellsStriped(
  g: CanvasRenderingContext2D,
  topLeftX: number,
  topLeftY: number,
  cell: number,
  rows: readonly string[],
  stripePhase: number,
  body: string,
  shade: string,
): void {
  for (let r = 0; r < rows.length; r++) {
    const tint = ((r + stripePhase) & 1) === 0 ? body : shade;
    g.fillStyle = tint;
    const row = rows[r] ?? "";
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "#") {
        g.fillRect(topLeftX + c * cell, topLeftY + r * cell, cell, cell);
      }
    }
  }
}

export type DinoPalette = { readonly body: string; readonly shade: string };

/** Draw Chromium-style dinosaur; colours come from palette (offline grey or user picker). */
export function drawSkinDino(
  g: CanvasRenderingContext2D,
  pb: { x: number; y: number; w: number; h: number },
  palette: DinoPalette,
  phase: "idle" | "running" | "dead",
  grounded: boolean,
  isDuck: boolean,
  runTime: number,
): void {
  const sprites = OFFLINE_DINO_SPRITES;
  const { body, shade } = palette;
  const stripePhase = stripePhaseForAlternateRows();

  if (isDuck) {
    const rows = Math.floor((runTime * 1000) / 135) % 2 === 0 ? sprites.duck0 : sprites.duck1;
    let maxW = 0;
    for (const row of rows) maxW = Math.max(maxW, row.length);
    const maxH = rows.length;
    const cell = Math.min(pb.w / maxW, pb.h / maxH);
    const drawW = maxW * cell;
    const drawH = maxH * cell;
    const ox = pb.x + (pb.w - drawW) * 0.5;
    const oy = pb.y + (pb.h - drawH);
    drawBitmapCellsStriped(g, ox, oy, cell, rows, stripePhase, body, shade);
    return;
  }

  let rows: readonly string[];
  if (phase !== "running") {
    rows = sprites.runFrames[0];
  } else if (!grounded) {
    rows = sprites.jump;
  } else {
    const runIdx =
      Math.floor((runTime * 1000) / RUN_FRAME_MS) % sprites.runFrames.length;
    rows = sprites.runFrames[runIdx];
  }

  let maxW = 0;
  for (const row of rows) maxW = Math.max(maxW, row.length);
  const maxH = rows.length;
  const cell = Math.min(pb.w / maxW, pb.h / maxH);
  const drawW = maxW * cell;
  const drawH = maxH * cell;
  const ox = pb.x + (pb.w - drawW) * 0.5;
  const oy = pb.y + (pb.h - drawH);

  drawBitmapCellsStriped(g, ox, oy, cell, rows, stripePhase, body, shade);
}
