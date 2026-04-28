/**
 * Chrome offline T-Rex aesthetic: monochrome sprites (grid of cells).
 * Coords: y grows downward; each cell maps to `cell` canvas pixels.
 */

export const CHROME = {
  ink: "#535353",
  sky: "#f7f7f7",
  groundStripe: "#fafafa",
  cloud: "#dcdcdc",
  horizon: "#535353",
} as const;

/** Rows use '#' for ink, '.' for empty. */
const REX_RUN_0: readonly string[] = [
  "....................",
  "........########....",
  ".......##########...",
  "......###########...",
  "......#########.....",
  "......########......",
  "......#########.....",
  ".......#######......",
  "........#####.......",
  "......####..##......",
  ".....####...###.....",
  "....####....####....",
  "...####.....####....",
  "..####......####....",
  ".####.......####....",
  "####.........####...",
  "###..........####...",
  "###..........#####..",
  "##...........#####..",
  "#............#####..",
  ".............#####..",
  "....#.........###...",
];

const REX_RUN_1: readonly string[] = [
  "....................",
  "........########....",
  ".......##########...",
  "......###########...",
  "......#########.....",
  "......########......",
  "......#########.....",
  ".......#######......",
  "........#####.......",
  "......####..##......",
  ".....####...###.....",
  "....####....####....",
  "...####.....####....",
  "..####......####....",
  ".####.......####....",
  "####.........####...",
  "###..........####...",
  "###..........#####..",
  "##.......#...#####..",
  "#.......###..#####..",
  ".........#....###...",
];

const REX_JUMP: readonly string[] = [
  "....................",
  "........########....",
  ".......##########...",
  "......###########...",
  "......#########.....",
  "......########......",
  "......#########.....",
  ".......#######......",
  "........#####.......",
  "......####..##......",
  ".....####...###.....",
  "....####....####....",
  "...####.....####....",
  "..####......####....",
  ".####.......####....",
  "####.........####...",
  "###..........####...",
  "###..........#####..",
  "##...........#####..",
  "#............#####..",
  ".............#####..",
  "..............###...",
];

const REX_DUCK: readonly string[] = [
  "..#######################....",
  "..########################...",
  "...#######################...",
  "....######################..",
  "....########...###########..",
  "....########.#..###########.",
  "...##########....###########",
  "..##########......##########",
  ".##########........#########",
  "###########.........########",
  "##########..........########",
  "########.............#######",
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
      const ch = row[c];
      if (ch === "#") {
        g.fillRect(topLeftX + c * cell, topLeftY + r * cell, cell, cell);
      }
    }
  }
}

/**
 * Draw Chrome-style monochrome T-Rex into the player hit box (bottom-aligned).
 */
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
    const rows = REX_DUCK;
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
    rows = Math.floor(runTime / 85) % 2 === 0 ? REX_RUN_0 : REX_RUN_1;
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

/** Sparse pterosaur silhouette (triangle body + angular wings). */
export function drawChromeBird(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  scroll: number,
): void {
  const ink = CHROME.ink;
  const flap = Math.sin(scroll * 0.02) > 0 ? 1 : -1;

  g.fillStyle = ink;
  g.fillRect(b.x + b.w * 0.35, b.y + b.h * 0.35, b.w * 0.52, b.h * 0.42);

  g.beginPath();
  g.moveTo(b.x + b.w * 0.12, b.y + b.h * (0.45 + flap * 0.04));
  g.lineTo(b.x + b.w * 0.38, b.y + b.h * (0.2 + flap * 0.12));
  g.lineTo(b.x + b.w * 0.55, b.y + b.h * 0.45);
  g.closePath();
  g.fill();

  g.beginPath();
  g.moveTo(b.x + b.w * 0.55, b.y + b.h * 0.45);
  g.lineTo(b.x + b.w * 0.88, b.y + b.h * (0.22 + flap * 0.1));
  g.lineTo(b.x + b.w * 0.92, b.y + b.h * 0.55);
  g.closePath();
  g.fill();

  g.fillRect(b.x + b.w * 0.78, b.y + b.h * 0.48, b.w * 0.12, b.h * 0.1);
}

/** Stacked columns + arm segments like the original cactus cluster. */
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
