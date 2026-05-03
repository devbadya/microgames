import * as pc from "playcanvas";
import {
  LEVELS,
  activeWidth,
  applyClear,
  buildGarbage,
  clampLevel,
  dropIntervalForLines,
  emptyBoard,
  failRun,
  levelById,
  pickPiece,
  pushGarbageRow,
  readBest,
  readUnlocked,
  recordBest,
  shouldAddGarbage,
  startRun,
  unlockNext,
  type Board,
  type Cell,
  type LevelDef,
  type PieceKey,
  type RunState,
  type StorageLike,
} from "./tetris-logic";

const COLS = 10;
const ROWS = 20;

type ColorKey = PieceKey | "G" | "bg" | "empty" | "border" | "ghost" | "shaded";

const COLORS: Record<ColorKey, pc.Color> = {
  bg: new pc.Color(0.04, 0.06, 0.10),
  empty: new pc.Color(0.10, 0.13, 0.19),
  shaded: new pc.Color(0.06, 0.08, 0.13),
  border: new pc.Color(0.18, 0.22, 0.30),
  ghost: new pc.Color(0.20, 0.24, 0.32),
  I: new pc.Color(0.40, 0.86, 0.96),
  O: new pc.Color(0.96, 0.84, 0.36),
  T: new pc.Color(0.78, 0.46, 0.92),
  S: new pc.Color(0.46, 0.86, 0.56),
  Z: new pc.Color(0.96, 0.46, 0.46),
  J: new pc.Color(0.40, 0.56, 0.96),
  L: new pc.Color(0.98, 0.66, 0.40),
  G: new pc.Color(0.42, 0.46, 0.55),
};

const PIECES: Record<PieceKey, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

interface Piece {
  key: PieceKey;
  shape: number[][];
  x: number;
  y: number;
}

function rotateCW(matrix: number[][]): number[][] {
  const h = matrix.length;
  const w = matrix[0]!.length;
  const out: number[][] = Array.from({ length: w }, () => new Array<number>(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[x]![h - 1 - y] = matrix[y]![x]!;
    }
  }
  return out;
}

function shapeCells(matrix: number[][], ox: number, oy: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x]) cells.push([ox + x, oy + y]);
    }
  }
  return cells;
}

function withinActiveColumn(x: number, fieldWidth: number): boolean {
  if (fieldWidth >= COLS) return true;
  const margin = Math.floor((COLS - fieldWidth) / 2);
  return x >= margin && x < margin + fieldWidth;
}

function canPlace(board: Board, matrix: number[][], ox: number, oy: number, fieldWidth: number): boolean {
  for (const [x, y] of shapeCells(matrix, ox, oy)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (!withinActiveColumn(x, fieldWidth)) return false;
    if (y >= 0 && board[y]![x] !== null) return false;
  }
  return true;
}

function spawnPiece(level: LevelDef, rng: () => number): Piece {
  const k = pickPiece(level, rng);
  const shape = PIECES[k].map((row) => row.slice());
  return {
    key: k,
    shape,
    x: Math.floor((COLS - shape[0]!.length) / 2),
    y: -shape.length,
  };
}

function lockPiece(board: Board, piece: Piece): boolean {
  let topOut = false;
  for (const [x, y] of shapeCells(piece.shape, piece.x, piece.y)) {
    if (y < 0) {
      topOut = true;
      continue;
    }
    board[y]![x] = piece.key;
  }
  return !topOut;
}

function clearLines(board: Board): number {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y]!.every((c) => c !== null)) {
      board.splice(y, 1);
      board.unshift(new Array<Cell>(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function gravitonCollapse(board: Board): void {
  for (let x = 0; x < COLS; x++) {
    const stack: Cell[] = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      const c = board[y]![x];
      if (c !== null) stack.push(c);
    }
    for (let y = ROWS - 1, i = 0; y >= 0; y--, i++) {
      board[y]![x] = stack[i] ?? null;
    }
  }
}

function ghostY(board: Board, piece: Piece, fieldWidth: number): number {
  let y = piece.y;
  while (canPlace(board, piece.shape, piece.x, y + 1, fieldWidth)) y += 1;
  return y;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const modifierBadge = document.getElementById("modifierBadge") as HTMLElement | null;
const overlayEl = document.getElementById("overlay") as HTMLElement | null;
const overlayMsg = document.getElementById("overlayMsg") as HTMLElement | null;
const overlayHint = document.getElementById("overlayHint") as HTMLElement | null;
const overlayEyebrow = document.getElementById("overlayEyebrow") as HTMLElement | null;
const overlayPrimary = document.getElementById("overlayPrimaryBtn") as HTMLButtonElement | null;
const overlaySecondary = document.getElementById("overlaySecondaryBtn") as HTMLButtonElement | null;
const levelSelectEl = document.getElementById("levelSelect") as HTMLElement | null;
const levelGridEl = document.getElementById("levelGrid") as HTMLElement | null;
const hudLevelEl = document.getElementById("hudLevel");
const hudLinesEl = document.getElementById("hudLines");
const hudScoreEl = document.getElementById("hudScore");

const STORAGE: StorageLike = (() => {
  try {
    return window.localStorage;
  } catch {
    const map = new Map<string, string>();
    return {
      getItem: (k) => (map.has(k) ? map.get(k)! : null),
      setItem: (k, v) => {
        map.set(k, v);
      },
    };
  }
})();

let unlocked = clampLevel(readUnlocked(STORAGE));
let currentLevel: LevelDef = levelById(1)!;
let run: RunState = startRun(1);

const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  keyboard: new pc.Keyboard(window),
  graphicsDeviceOptions: { antialias: true, alpha: false },
});

app.setCanvasFillMode(pc.FILLMODE_NONE);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const camera = new pc.Entity("camera");
camera.addComponent("camera", {
  projection: pc.PROJECTION_ORTHOGRAPHIC,
  orthoHeight: ROWS / 2 + 1,
  clearColor: COLORS.bg,
  nearClip: 0.1,
  farClip: 100,
});
camera.setPosition(0, 0, 30);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

const keyLight = new pc.Entity("keyLight");
keyLight.addComponent("light", {
  type: "directional",
  color: new pc.Color(1, 1, 1),
  intensity: 1.0,
});
keyLight.setEulerAngles(45, 30, 0);
app.root.addChild(keyLight);

const fillLight = new pc.Entity("fillLight");
fillLight.addComponent("light", {
  type: "directional",
  color: new pc.Color(0.55, 0.65, 0.95),
  intensity: 0.55,
});
fillLight.setEulerAngles(-25, -45, 0);
app.root.addChild(fillLight);

const rim = new pc.Entity("rim");
rim.addComponent("light", {
  type: "directional",
  color: new pc.Color(1.0, 0.85, 0.95),
  intensity: 0.35,
});
rim.setEulerAngles(180, 0, 0);
app.root.addChild(rim);

const materials = new Map<string, pc.StandardMaterial>();
function getMaterial(color: pc.Color): pc.StandardMaterial {
  const key = `${color.r.toFixed(3)}-${color.g.toFixed(3)}-${color.b.toFixed(3)}`;
  let m = materials.get(key);
  if (!m) {
    m = new pc.StandardMaterial();
    m.diffuse = color;
    m.useMetalness = true;
    m.metalness = 0.05;
    m.gloss = 0.5;
    m.update();
    materials.set(key, m);
  }
  return m;
}

const xOffset = -(COLS - 1) / 2;
const yOffset = (ROWS - 1) / 2;

const cellEntities: pc.Entity[][] = [];
for (let y = 0; y < ROWS; y++) {
  const row: pc.Entity[] = [];
  for (let x = 0; x < COLS; x++) {
    const e = new pc.Entity();
    e.addComponent("render", { type: "box" });
    e.setLocalScale(0.92, 0.92, 0.92);
    e.setPosition(xOffset + x, yOffset - y, 0);
    e.render!.material = getMaterial(COLORS.empty);
    app.root.addChild(e);
    row.push(e);
  }
  cellEntities.push(row);
}

(function makeBorder(): void {
  const w = COLS + 0.4;
  const h = ROWS + 0.4;
  const t = 0.2;
  const sides = [
    { x: 0, y: yOffset + 0.5 + t / 2, sx: w, sy: t },
    { x: 0, y: -yOffset - 0.5 - t / 2, sx: w, sy: t },
    { x: xOffset - 0.5 - t / 2, y: 0, sx: t, sy: h },
    { x: -xOffset + 0.5 + t / 2, y: 0, sx: t, sy: h },
  ];
  for (const s of sides) {
    const e = new pc.Entity();
    e.addComponent("render", { type: "box" });
    e.setLocalScale(s.sx, s.sy, 0.5);
    e.setPosition(s.x, s.y, 0);
    e.render!.material = getMaterial(COLORS.border);
    app.root.addChild(e);
  }
})();

let board: Board = emptyBoard(ROWS, COLS);
let piece: Piece = spawnPiece(currentLevel, Math.random);
let dropAccumulator = 0;
let dropInterval = 0.7;
let phase: "select" | "running" | "complete" | "failed" | "paused" = "select";

function updateHud(): void {
  if (hudLevelEl) hudLevelEl.textContent = String(currentLevel.id);
  if (hudLinesEl) hudLinesEl.textContent = `${run.linesCredited}/${run.goal}`;
  if (hudScoreEl) hudScoreEl.textContent = String(run.score);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLevelGrid(): void {
  if (!levelGridEl) return;
  const best = readBest(STORAGE);
  levelGridEl.innerHTML = LEVELS.map((lv) => {
    const isLocked = lv.id > unlocked;
    const cleared = lv.id < unlocked;
    const classes = ["shLevelCard"];
    if (lv.id === currentLevel.id) classes.push("shLevelCard--current");
    if (cleared) classes.push("shLevelCard--cleared");
    const meta = isLocked ? "Locked" : `${lv.goalLines} lines`;
    const disabled = isLocked ? "disabled" : "";
    return `
      <button type="button" class="${classes.join(" ")}" data-level="${lv.id}" ${disabled} aria-label="Level ${lv.id} ${lv.name}">
        <span class="shLevelCardId">Lv ${lv.id}</span>
        <span class="shLevelCardName">${escapeHtml(lv.name)}</span>
        <span class="shLevelCardMeta">${meta}${best[lv.id] ? ` · best ${best[lv.id]}` : ""}</span>
      </button>
    `;
  }).join("");
  for (const btn of levelGridEl.querySelectorAll<HTMLButtonElement>("button[data-level]")) {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-level"));
      if (Number.isFinite(id)) startLevel(id);
    });
  }
}

function setOverlay(opts: {
  visible: boolean;
  eyebrow?: string;
  message?: string;
  hint?: string;
  showLevelSelect?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string | null;
}): void {
  if (!overlayEl) return;
  if (!opts.visible) {
    overlayEl.hidden = true;
    return;
  }
  overlayEl.hidden = false;
  if (overlayEyebrow) overlayEyebrow.textContent = opts.eyebrow ?? "Tetris";
  if (overlayMsg) overlayMsg.textContent = opts.message ?? "";
  if (overlayHint) overlayHint.textContent = opts.hint ?? "";
  if (levelSelectEl) levelSelectEl.hidden = !opts.showLevelSelect;
  if (overlayPrimary) {
    overlayPrimary.textContent = opts.primaryLabel ?? "Play";
    overlayPrimary.hidden = false;
  }
  if (overlaySecondary) {
    if (opts.secondaryLabel) {
      overlaySecondary.textContent = opts.secondaryLabel;
      overlaySecondary.hidden = false;
    } else {
      overlaySecondary.hidden = true;
    }
  }
}

function showLevelSelect(): void {
  phase = "select";
  if (modifierBadge) modifierBadge.textContent = "";
  renderLevelGrid();
  setOverlay({
    visible: true,
    eyebrow: "Tetris",
    message: "Pick a level",
    hint: `Cleared up to ${unlocked}/${LEVELS.length}.`,
    showLevelSelect: true,
    primaryLabel: `Continue (Lv ${unlocked})`,
    secondaryLabel: null,
  });
}

function hideOverlay(): void {
  setOverlay({ visible: false });
}

function applyTheme(level: LevelDef): void {
  document.documentElement.style.setProperty("--accent", level.palette.primary);
  document.documentElement.style.setProperty("--accent2", level.palette.secondary);
  if (modifierBadge) {
    modifierBadge.textContent = level.modifier === "none" ? "" : `Modifier: ${level.modifier}`;
  }
}

function startLevel(id: number): void {
  const def = levelById(clampLevel(id));
  if (!def) return;
  if (def.id > unlocked) return;
  currentLevel = def;
  applyTheme(def);
  run = startRun(def.id);
  board = def.startingGarbage > 0
    ? buildGarbage(ROWS, COLS, def.startingGarbage, Math.random)
    : emptyBoard(ROWS, COLS);
  piece = spawnPiece(def, Math.random);
  dropAccumulator = 0;
  dropInterval = dropIntervalForLines(def, 0);
  phase = "running";
  hideOverlay();
  updateHud();
}

function endLevelFailure(message: string): void {
  if (phase !== "running" && phase !== "paused") return;
  phase = "failed";
  run = failRun(run);
  recordBest(STORAGE, currentLevel.id, run.score);
  setOverlay({
    visible: true,
    eyebrow: "Game over",
    message: `${currentLevel.name} — ${run.score} pts`,
    hint: message,
    showLevelSelect: false,
    primaryLabel: "Retry",
    secondaryLabel: "Levels",
  });
}

function endLevelClear(): void {
  if (phase !== "running") return;
  phase = "complete";
  recordBest(STORAGE, currentLevel.id, run.score);
  unlocked = unlockNext(STORAGE, currentLevel.id);
  const isFinal = currentLevel.id === LEVELS.length;
  setOverlay({
    visible: true,
    eyebrow: isFinal ? "Campaign cleared" : "Level cleared",
    message: `${currentLevel.name} — ${run.score} pts`,
    hint: isFinal
      ? "Pick any level to push your high score."
      : `Next: ${levelById(currentLevel.id + 1)?.name ?? ""}.`,
    showLevelSelect: false,
    primaryLabel: isFinal ? "Levels" : "Next level",
    secondaryLabel: "Levels",
  });
}

function tryMove(dx: number, dy: number): boolean {
  if (canPlace(board, piece.shape, piece.x + dx, piece.y + dy, activeWidth(currentLevel, run.linesCredited, COLS))) {
    piece.x += dx;
    piece.y += dy;
    return true;
  }
  return false;
}

function tryRotate(): void {
  const r = rotateCW(piece.shape);
  const fw = activeWidth(currentLevel, run.linesCredited, COLS);
  for (const dx of [0, -1, 1, -2, 2]) {
    if (canPlace(board, r, piece.x + dx, piece.y, fw)) {
      piece.shape = r;
      piece.x += dx;
      return;
    }
  }
}

function softDrop(): void {
  if (tryMove(0, 1)) {
    run = { ...run, score: run.score + 1 };
  } else {
    settle();
  }
}

function hardDrop(): void {
  let dropped = 0;
  while (tryMove(0, 1)) dropped += 1;
  run = { ...run, score: run.score + dropped * 2 };
  settle();
}

function settle(): void {
  const ok = lockPiece(board, piece);
  if (!ok) {
    endLevelFailure("Top out — pick the level again.");
    return;
  }
  const cleared = clearLines(board);
  if (cleared > 0) {
    run = applyClear(run, currentLevel, cleared);
    if (currentLevel.modifier === "graviton") gravitonCollapse(board);
    dropInterval = dropIntervalForLines(currentLevel, run.linesCredited);
    if (run.cleared) {
      updateHud();
      endLevelClear();
      return;
    }
    if (shouldAddGarbage(currentLevel, run.linesCredited)) {
      board = pushGarbageRow(board, Math.random);
    }
  }
  piece = spawnPiece(currentLevel, Math.random);
  if (!canPlace(board, piece.shape, piece.x, piece.y, activeWidth(currentLevel, run.linesCredited, COLS))) {
    endLevelFailure("Field choked.");
    return;
  }
  updateHud();
}

type Action = "left" | "right" | "rotate" | "softdrop" | "harddrop";

function performAction(action: Action): void {
  if (phase !== "running") return;
  switch (action) {
    case "left":
      tryMove(-1, 0);
      break;
    case "right":
      tryMove(1, 0);
      break;
    case "rotate":
      tryRotate();
      break;
    case "softdrop":
      softDrop();
      updateHud();
      break;
    case "harddrop":
      hardDrop();
      updateHud();
      break;
  }
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const k = e.key;
  if (k === "Escape") {
    e.preventDefault();
    showLevelSelect();
    return;
  }
  if (k === "Enter" || k === "r" || k === "R") {
    e.preventDefault();
    if (phase === "select") {
      startLevel(unlocked);
    } else if (phase === "complete" && currentLevel.id < LEVELS.length) {
      startLevel(currentLevel.id + 1);
    } else if (phase === "complete") {
      showLevelSelect();
    } else if (phase === "failed") {
      startLevel(currentLevel.id);
    }
    return;
  }
  if (phase !== "running" && phase !== "paused") return;
  if (k === "p" || k === "P") {
    if (phase === "running") {
      phase = "paused";
      setOverlay({
        visible: true,
        eyebrow: "Paused",
        message: currentLevel.name,
        hint: "P to resume · Esc for levels",
        showLevelSelect: false,
        primaryLabel: "Resume",
        secondaryLabel: "Levels",
      });
    } else {
      phase = "running";
      hideOverlay();
    }
    e.preventDefault();
    return;
  }
  if (phase !== "running") return;
  if (k === "ArrowLeft") {
    performAction("left");
    e.preventDefault();
  } else if (k === "ArrowRight") {
    performAction("right");
    e.preventDefault();
  } else if (k === "ArrowDown") {
    performAction("softdrop");
    e.preventDefault();
  } else if (k === "ArrowUp" || k === "x" || k === "X") {
    performAction("rotate");
    e.preventDefault();
  } else if (k === " ") {
    performAction("harddrop");
    e.preventDefault();
  }
});

const REPEATABLE: ReadonlySet<Action> = new Set<Action>(["left", "right", "softdrop"]);
const REPEAT_DELAY_MS = 220;
const REPEAT_INTERVAL_MS = 60;

function bindTouchButton(btn: HTMLButtonElement): void {
  const action = btn.dataset["action"] as Action | undefined;
  if (!action) return;

  let delayTimer: number | null = null;
  let repeatTimer: number | null = null;

  const stop = (): void => {
    if (delayTimer !== null) {
      window.clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (repeatTimer !== null) {
      window.clearInterval(repeatTimer);
      repeatTimer = null;
    }
    btn.classList.remove("is-active");
  };

  btn.addEventListener("pointerdown", (e: PointerEvent) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    btn.classList.add("is-active");
    performAction(action);
    if (REPEATABLE.has(action)) {
      delayTimer = window.setTimeout(() => {
        repeatTimer = window.setInterval(() => performAction(action), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  });

  for (const ev of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) {
    btn.addEventListener(ev, stop);
  }

  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

const touchControlsEl = document.getElementById("touchControls");
if (touchControlsEl) {
  for (const btn of touchControlsEl.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
    bindTouchButton(btn);
  }
}

if (overlayPrimary) {
  overlayPrimary.addEventListener("click", () => {
    if (phase === "select") startLevel(unlocked);
    else if (phase === "complete") {
      if (currentLevel.id < LEVELS.length) startLevel(currentLevel.id + 1);
      else showLevelSelect();
    } else if (phase === "failed") startLevel(currentLevel.id);
    else if (phase === "paused") {
      phase = "running";
      hideOverlay();
    }
  });
}
if (overlaySecondary) overlaySecondary.addEventListener("click", () => showLevelSelect());

document.addEventListener(
  "gesturestart",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

function renderBoard(): void {
  const fw = activeWidth(currentLevel, run.linesCredited, COLS);
  const margin = Math.floor((COLS - fw) / 2);
  const ghostPos = phase === "running" && canPlace(board, piece.shape, piece.x, piece.y, fw)
    ? ghostY(board, piece, fw)
    : piece.y;

  for (let y = 0; y < ROWS; y++) {
    const row = board[y]!;
    const ents = cellEntities[y]!;
    for (let x = 0; x < COLS; x++) {
      const k = row[x];
      if (!withinActiveColumn(x, fw)) {
        ents[x]!.render!.material = getMaterial(COLORS.shaded);
      } else if (k) {
        ents[x]!.render!.material = getMaterial(COLORS[k]);
      } else {
        ents[x]!.render!.material = getMaterial(COLORS.empty);
      }
      ents[x]!.enabled = true;
      if (!withinActiveColumn(x, fw) && fw < COLS) {
        // shaded outside active band — keep visible so the field looks framed
      }
    }
  }

  if (phase === "running" && currentLevel.modifier !== "noGhost") {
    for (const [x, y] of shapeCells(piece.shape, piece.x, ghostPos)) {
      if (y >= 0 && y < ROWS && x >= margin && x < margin + fw && board[y]![x] === null) {
        cellEntities[y]![x]!.render!.material = getMaterial(COLORS.ghost);
      }
    }
  }

  if (phase === "running") {
    for (const [x, y] of shapeCells(piece.shape, piece.x, piece.y)) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        cellEntities[y]![x]!.render!.material = getMaterial(COLORS[piece.key]);
      }
    }
  }
}

app.on("update", (dt: number) => {
  if (phase === "running") {
    dropAccumulator += dt;
    while (dropAccumulator >= dropInterval) {
      dropAccumulator -= dropInterval;
      if (!tryMove(0, 1)) {
        settle();
        break;
      }
    }
  }
  renderBoard();
});

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  app.resizeCanvas(w, h);
  const aspect = w / h;
  const minBoardW = COLS + 1.6;
  const minBoardH = ROWS + 1.6;
  const oh = Math.max(minBoardH / 2, minBoardW / 2 / aspect);
  camera.camera!.orthoHeight = oh;
}

window.addEventListener("resize", fitToStage);
const ro = new ResizeObserver(fitToStage);
ro.observe(stage);

applyTheme(currentLevel);
fitToStage();
showLevelSelect();
updateHud();
app.start();

interface TetrisTestApi {
  start(level?: number): void;
  clearLines(count: number): { score: number; cleared: boolean };
  state(): { level: number; lines: number; goal: number; cleared: boolean; failed: boolean };
}

(window as unknown as { __tetrisTest?: TetrisTestApi }).__tetrisTest = {
  start(level = 1) {
    unlocked = clampLevel(Math.max(unlocked, level));
    startLevel(level);
  },
  clearLines(count) {
    const def = currentLevel;
    run = applyClear(run, def, count);
    updateHud();
    if (run.cleared) endLevelClear();
    return { score: run.score, cleared: run.cleared };
  },
  state() {
    return {
      level: currentLevel.id,
      lines: run.linesCredited,
      goal: run.goal,
      cleared: run.cleared,
      failed: run.failed,
    };
  },
};
