/**
 * Pixel dinosaur skins (2D silhouettes). Names match the asset pack .blend files.
 */

import { CHROME } from "./chrome-sprites";

export const DINO_SKIN_IDS = [
  "trex",
  "apatosaurus",
  "parasaurolophus",
  "stegosaurus",
  "triceratops",
  "velociraptor",
] as const;

export type DinoSkinId = (typeof DINO_SKIN_IDS)[number];

const LS_SKIN_KEY = "microgames.dinoRun.skin";

export function loadStoredSkin(): DinoSkinId {
  const raw = window.localStorage.getItem(LS_SKIN_KEY);
  if (raw && (DINO_SKIN_IDS as readonly string[]).includes(raw)) {
    return raw as DinoSkinId;
  }
  return "trex";
}

export function storeSkin(id: DinoSkinId): void {
  window.localStorage.setItem(LS_SKIN_KEY, id);
}

export const DINO_SKIN_LABELS: Record<DinoSkinId, string> = {
  trex: "T‑Rex",
  apatosaurus: "Apatosaurus",
  parasaurolophus: "Parasaurolophus",
  stegosaurus: "Stegosaurus",
  triceratops: "Triceratops",
  velociraptor: "Velociraptor",
};

/** Source filenames in Dinosaur Animated Pack (Blend). */
export const DINO_SKIN_BLEND_FILES: Record<DinoSkinId, string> = {
  trex: "Trex.blend",
  apatosaurus: "Apatosaurus.blend",
  parasaurolophus: "Parasaurolophus.blend",
  stegosaurus: "Stegosaurus.blend",
  triceratops: "Triceratops.blend",
  velociraptor: "Velociraptor.blend",
};

export type SkinBitmaps = {
  run0: readonly string[];
  run1: readonly string[];
  jump: readonly string[];
  duck0: readonly string[];
  duck1: readonly string[];
};

const TREX_RUN_0: readonly string[] = [
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

const TREX_RUN_1: readonly string[] = [
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

const TREX_JUMP: readonly string[] = [
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
];

const TREX_DUCK_0: readonly string[] = [
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

const TREX_DUCK_1: readonly string[] = [
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

const APATO_RUN_0: readonly string[] = [
  "...#.................",
  "...##................",
  "...###...............",
  "....######...........",
  ".....#######.........",
  "......######.........",
  ".......######........",
  "........######.......",
  ".........######......",
  "..........#####......",
  "...################..",
  "..#################..",
  "..################...",
  "..###############....",
  "..###############....",
  "..##############.....",
  "..#############......",
  "..############.......",
  "..###########........",
  "...#########.........",
  "....######...........",
  "......######.........",
  "###...######.........",
  "##.....###...........",
];

const APATO_RUN_1: readonly string[] = [
  "...#.................",
  "...##................",
  "...###...............",
  "....######...........",
  ".....#######.........",
  "......######.........",
  ".......######........",
  "........######.......",
  ".........######......",
  "..........#####......",
  "...################..",
  "..#################..",
  "..################...",
  "..###############....",
  "..###############....",
  "..##############.....",
  "..#############......",
  "..############.......",
  "..###########........",
  "...#########.........",
  "....######...........",
  "......######.........",
  "###...######.........",
  "##.......###.........",
];

function paraFromTrex(run: readonly string[]): readonly string[] {
  return run.map((row, ri) => {
    if (ri < 2 || ri > 15) return row;
    const a = row.split("");
    for (let r = 0; r < 14 - Math.max(0, ri - 2); r++) {
      const col = 18 - Math.floor(r / 3);
      if (col >= 0 && col < a.length) a[col] = "#";
    }
    if (ri <= 10) {
      if (a[19] !== undefined) a[19] = "#";
      if (ri <= 6 && a[20] !== undefined) a[20] = "#";
    }
    return a.join("");
  });
}

function stegoFromTrex(run: readonly string[]): readonly string[] {
  return run.map((row, ri) => {
    if (ri === 6 || ri === 9 || ri === 12) {
      const a = row.split("");
      for (let c = 8; c <= 15 && c < a.length; c++) a[c] = "#";
      return a.join("");
    }
    if (ri === 15) {
      const a = row.split("");
      for (let c = 7; c <= 16 && c < a.length; c++) a[c] = "#";
      return a.join("");
    }
    return row;
  });
}

function trikeFromTrex(run: readonly string[]): readonly string[] {
  return run.map((row, ri) => {
    if (ri < 7 || ri > 17) return row;
    const a = row.split("");
    if (ri >= 7 && ri <= 13) {
      for (let c = 13; c < Math.min(row.length, 21); c++) a[c] = "#";
    }
    if ((ri === 11 || ri === 12) && a[20] !== undefined) a[20] = "#";
    return a.join("");
  });
}

/** Slimmer profile: trim ink on the right side of each row. */
function veloFromTrex(run: readonly string[]): readonly string[] {
  return run.map((line) => {
    const chars = [...line];
    for (let c = 16; c < chars.length; c++) {
      if (chars[c] === "#") chars[c] = ".";
    }
    return chars.join("");
  });
}

const SKINS: Record<DinoSkinId, SkinBitmaps> = {
  trex: {
    run0: TREX_RUN_0,
    run1: TREX_RUN_1,
    jump: TREX_JUMP,
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  apatosaurus: {
    run0: APATO_RUN_0,
    run1: APATO_RUN_1,
    jump: APATO_RUN_0,
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  parasaurolophus: {
    run0: paraFromTrex(TREX_RUN_0),
    run1: paraFromTrex(TREX_RUN_1),
    jump: paraFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  stegosaurus: {
    run0: stegoFromTrex(TREX_RUN_0),
    run1: stegoFromTrex(TREX_RUN_1),
    jump: stegoFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  triceratops: {
    run0: trikeFromTrex(TREX_RUN_0),
    run1: trikeFromTrex(TREX_RUN_1),
    jump: trikeFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  velociraptor: {
    run0: veloFromTrex(TREX_RUN_0),
    run1: veloFromTrex(TREX_RUN_1),
    jump: veloFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
};

export function getSkinBitmaps(id: DinoSkinId): SkinBitmaps {
  return SKINS[id];
}

const RUN_CYCLE_MS = 68;

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

export function drawSkinDino(
  g: CanvasRenderingContext2D,
  pb: { x: number; y: number; w: number; h: number },
  skin: DinoSkinId,
  phase: "idle" | "running" | "dead",
  grounded: boolean,
  isDuck: boolean,
  runTime: number,
): void {
  const sprites = SKINS[skin];
  const ink = CHROME.ink;

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
    drawBitmapCells(g, ox, oy, cell, rows, ink);
    return;
  }

  let rows: readonly string[];
  if (phase !== "running") {
    rows = sprites.run0;
  } else if (!grounded) {
    rows = sprites.jump;
  } else {
    rows = Math.floor((runTime * 1000) / RUN_CYCLE_MS) % 2 === 0 ? sprites.run0 : sprites.run1;
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
