/**
 * Pixel dinosaur skins (2D silhouettes). Names match the asset pack .blend files.
 */

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

/** Per-skin arcade colors (two-tone shading on pixel rows). */
export const SKIN_PAIR: Record<DinoSkinId, { body: string; shade: string }> = {
  trex: { body: "#f0cf7a", shade: "#c49a42" },
  apatosaurus: { body: "#8ec7ec", shade: "#4f8fc9" },
  parasaurolophus: { body: "#dcb3ff", shade: "#9d54d4" },
  stegosaurus: { body: "#7bdc9f", shade: "#3aa860" },
  triceratops: { body: "#ffaeb5", shade: "#e56872" },
  velociraptor: { body: "#5eecda", shade: "#2cae9a" },
};

export type SkinBitmaps = {
  /** Four frames at ~12–13 fps for a clear walk cycle. */
  runFrames: readonly [readonly string[], readonly string[], readonly string[], readonly string[]];
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

/** Extra run phases: same upper body as TREX_RUN_0 (first 17 rows), legs 17–23 only. */
const TREX_LEGS_1: readonly string[] = [
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "###..........###.....",
  "##.............###...",
  "...#............##...",
];

const TREX_LEGS_3: readonly string[] = [
  "########...###.......",
  "######.....####......",
  "#####.......####.....",
  "####.........###.....",
  "##...........###.....",
  "##.............###...",
  ".......#.........##..",
];

const TREX_RUN_PREFIX17 = TREX_RUN_0.slice(0, 17);

const TREX_RUN_FRAMES: readonly [
  readonly string[],
  readonly string[],
  readonly string[],
  readonly string[],
] = [
  TREX_RUN_0,
  [...TREX_RUN_PREFIX17, ...TREX_LEGS_1],
  TREX_RUN_1,
  [...TREX_RUN_PREFIX17, ...TREX_LEGS_3],
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

/** Mid gait: only row 23 moves between APATO_RUN_0 and APATO_RUN_1. */
const APATO_ROW23_PASS = "##......###..........";

function apatoRow23Frame(base: readonly string[]): readonly string[] {
  return base.map((row, i) => (i === 23 ? APATO_ROW23_PASS : row));
}

const APATO_RUN_FRAMES: readonly [
  readonly string[],
  readonly string[],
  readonly string[],
  readonly string[],
] = [APATO_RUN_0, apatoRow23Frame(APATO_RUN_0), APATO_RUN_1, apatoRow23Frame(APATO_RUN_1)];

function mapRunFrames(
  frames: readonly [
    readonly string[],
    readonly string[],
    readonly string[],
    readonly string[],
  ],
  fn: (row: readonly string[]) => readonly string[],
): readonly [
  readonly string[],
  readonly string[],
  readonly string[],
  readonly string[],
] {
  return [fn(frames[0]), fn(frames[1]), fn(frames[2]), fn(frames[3])];
}

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
    runFrames: TREX_RUN_FRAMES,
    jump: TREX_JUMP,
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  apatosaurus: {
    runFrames: APATO_RUN_FRAMES,
    jump: APATO_RUN_0,
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  parasaurolophus: {
    runFrames: mapRunFrames(TREX_RUN_FRAMES, paraFromTrex),
    jump: paraFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  stegosaurus: {
    runFrames: mapRunFrames(TREX_RUN_FRAMES, stegoFromTrex),
    jump: stegoFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  triceratops: {
    runFrames: mapRunFrames(TREX_RUN_FRAMES, trikeFromTrex),
    jump: trikeFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
  velociraptor: {
    runFrames: mapRunFrames(TREX_RUN_FRAMES, veloFromTrex),
    jump: veloFromTrex(TREX_JUMP),
    duck0: TREX_DUCK_0,
    duck1: TREX_DUCK_1,
  },
};

export function getSkinBitmaps(id: DinoSkinId): SkinBitmaps {
  return SKINS[id];
}

const RUN_FRAME_MS = 52;

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
  const { body, shade } = SKIN_PAIR[skin];
  const stripePhase = DINO_SKIN_IDS.indexOf(skin) % 2;

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
