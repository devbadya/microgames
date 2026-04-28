/**
 * Chrome offline T-Rex aesthetic: monochrome sprites (grid of cells).
 */

export const CHROME = {
  ink: "#535353",
  sky: "#f7f7f7",
  cloud: "#dcdcdc",
  horizon: "#535353",
} as const;

/** Desert uses the same base color as sky (like Chrome); detail from marks only. */

/** Stand / jump bitmaps: '#' ink, '.' empty — 21×24 cells. */
const REX_RUN_0: readonly string[] = [
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
  "##############.......", // tail
  "#########.###........",
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "###...........###....",
  "##.............###...",
  "...#............##...",
];

const REX_RUN_1: readonly string[] = [
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
  "##############.......", // run: other leg
  "#########.###........",
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "##...........###.....",
  "...#............##...",
  "......#.........##...",
];

const REX_JUMP: readonly string[] = [
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
  "##############.......", // jump: legs tucked
  "#########.###........",
  "########....##.......",
  "######.......##......",
  "#####.........##.....",
  "####............#....",
  "###..............##..",
  "##................##.",
  "....................."
];

const REX_DUCK_0: readonly string[] = [
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
];

const REX_DUCK_1: readonly string[] = [
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
];

function drawBitmapCells(
  g: CanvasRenderingContext2D,
  topLeftX: number,
  topLeftY: number,
  cell: number,
  rows: readonly string[],
  ink: string,
): void {
  g.fillStyle = ink;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? "";
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "#") {
        g.fillRect(topLeftX + c * cell, topLeftY + r * cell, cell, cell);
      }
    }
  }
}

const RUN_CYCLE_MS = 68;

/** Draw T-Rex into hit box, bottom-aligned. */
export function drawChromeDino(
  g: CanvasRenderingContext2D,
  pb: { x: number; y: number; w: number; h: number },
  phase: "idle" | "running" | "dead",
  grounded: boolean,
  isDuck: boolean,
  runTime: number,
): void {
  const ink = CHROME.ink;

  if (isDuck) {
    const rows = Math.floor((runTime * 1000) / 135) % 2 === 0 ? REX_DUCK_0 : REX_DUCK_1;
    let maxW = 0;
    for (const row of rows) maxW = Math.max(maxW, row.length);
    const maxH = rows.length;
    const cell = Math.min(pb.w / maxW, pb.h / maxH);
    const drawW = maxW * cell;
    const drawH = maxH * cell;
    const ox = pb.x + (pb.w - drawW) * 0.5;
    const oy = pb.y + (pb.h - drawH);
    drawBitmapCells(g, ox, oy, cell, rows, ink);
    return;
  }

  let rows: readonly string[];
  if (phase !== "running") {
    rows = REX_RUN_0;
  } else if (!grounded) {
    rows = REX_JUMP;
  } else {
    rows = Math.floor((runTime * 1000) / RUN_CYCLE_MS) % 2 === 0 ? REX_RUN_0 : REX_RUN_1;
  }

  let maxW = 0;
  for (const row of rows) maxW = Math.max(maxW, row.length);
  const maxH = rows.length;
  const cell = Math.min(pb.w / maxW, pb.h / maxH);
  const drawW = maxW * cell;
  const drawH = maxH * cell;
  const ox = pb.x + (pb.w - drawW) * 0.5;
  const oy = pb.y + (pb.h - drawH);

  drawBitmapCells(g, ox, oy, cell, rows, ink);
}

/** Chrome-style sand: same fill as sky + scrolling pebbles and subtle diagonal marks. */
export function drawChromeDesertFloor(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  CANVAS_H: number,
  GROUND_Y: number,
  scroll: number,
): void {
  g.fillStyle = CHROME.sky;
  g.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  const drift = scroll * 1.12;
  g.fillStyle = CHROME.ink;
  /* Tiny pebbles — a few parallax-ish layers */
  const layers = [
    { count: 90, ys: 0.12, spd: 1.05 },
    { count: 55, ys: 0.35, spd: 0.92 },
    { count: 35, ys: 0.58, spd: 0.78 },
  ] as const;
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const h = CANVAS_H - GROUND_Y;
      const z = i * 977 + layer.count;
      let x =
        (((z * 793) >>> 5) % (CANVAS_W + 80)) - drift * layer.spd + Math.sin(z * 0.01 + layer.ys * 13) * 3;
      x = ((x % (CANVAS_W + 120)) + (CANVAS_W + 120)) % (CANVAS_W + 120) - 20;
      const y = GROUND_Y + 12 + ((((z >>> 5) % 1000) / 1000) * (h - 24) * (0.3 + layer.ys));
      const pw = (((z >>> 9) % 3) === 0 ? 2 : 1);
      const ph = (((z >>> 11) % 4) === 0 ? 2 : 1);
      if (x > -8 && x < CANVAS_W + 8 && y < CANVAS_H - 4) {
        g.fillRect(Math.round(x), Math.round(y), pw, ph);
      }
    }
  }

  /* Light diagonal scratches scrolling with the scene */
  g.globalAlpha = 0.38;
  g.strokeStyle = CHROME.horizon;
  g.lineWidth = 1;
  const zig = scroll * 0.72;
  for (let sx = -50; sx < CANVAS_W + 70; sx += 18) {
    const gx = Math.floor((sx + zig * 31) % 36);
    const bx = sx + gx * 0.12;
    const by = GROUND_Y + 22 + (sx % 7) + ((sx * 97) % 11);
    g.beginPath();
    g.moveTo(bx, by + 14);
    g.lineTo(bx + 14, by);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Pterosaur: two-wing-frame flap animation. */
export function drawChromeBird(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  runTime: number,
  birdId: number,
): void {
  const wing = (Math.floor(runTime * 11 + birdId * 1.873) % 2) as 0 | 1;
  drawChromeBirdFrame(g, b, wing);
}

function drawChromeBirdFrame(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  wing: 0 | 1,
): void {
  const ink = CHROME.ink;
  g.fillStyle = ink;

  const cx = b.x + b.w * 0.42;
  const cy = b.y + b.h * 0.48;
  g.fillRect(b.x + b.w * 0.32, b.y + b.h * 0.38, b.w * 0.55, b.h * 0.38);

  if (wing === 0) {
    /* wings down */
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.02, b.y + b.h * 0.95);
    g.lineTo(b.x + b.w * 0.28, b.y + b.h * 0.58);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.98, b.y + b.h * 0.88);
    g.lineTo(b.x + b.w * 0.72, b.y + b.h * 0.55);
    g.closePath();
    g.fill();
  } else {
    /* wings up */
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.05, b.y + b.h * 0.18);
    g.lineTo(b.x + b.w * 0.3, b.y + b.h * 0.42);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.96, b.y + b.h * 0.2);
    g.lineTo(b.x + b.w * 0.68, b.y + b.h * 0.45);
    g.closePath();
    g.fill();
  }

  g.fillRect(b.x + b.w * 0.78, b.y + b.h * 0.42, Math.max(3, b.w * 0.14), b.h * 0.14);
}

export function drawChromeCactus(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
): void {
  const ink = CHROME.ink;
  g.fillStyle = ink;
  const stemW = Math.max(4, b.w * 0.22);
  const cx = b.x + b.w * 0.5 - stemW * 0.5;
  g.fillRect(cx, b.y, stemW, b.h);
  if (b.w > 18) {
    const armH = Math.min(b.h * 0.32, 18);
    const armW = Math.max(5, b.w * 0.28);
    g.fillRect(b.x + b.w * 0.08, b.y + b.h * 0.38, armW, armH);
    g.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.32, armW, armH);
  }
}

export function drawChromeCloud(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle = CHROME.cloud;
  const u = Math.max(2, w * 0.25);
  g.fillRect(x, y + h * 0.35, w, h * 0.35);
  g.fillRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.45);
  g.fillRect(x + w * 0.35, y, w * 0.45, h * 0.45);
  g.fillRect(x + w * 0.55, y + h * 0.12, u, h * 0.35);
}

export function drawChromeHorizon(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const dash = 13;
  const gap = 11;
  const cycle = dash + gap;
  const off = -((scroll * 0.88) % cycle);
  g.fillStyle = CHROME.horizon;
  for (let x = off; x < CANVAS_W + cycle; x += cycle) {
    g.fillRect(x, GROUND_Y - 1, dash, 2);
  }
}
