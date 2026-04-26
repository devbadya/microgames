import * as pc from "playcanvas";

const COLS = 10;
const ROWS = 20;

const COLORS = {
  bg: new pc.Color(0.04, 0.06, 0.10),
  empty: new pc.Color(0.10, 0.13, 0.19),
  border: new pc.Color(0.18, 0.22, 0.30),
  ghost: new pc.Color(0.20, 0.24, 0.32),
  I: new pc.Color(0.40, 0.86, 0.96),
  O: new pc.Color(0.96, 0.84, 0.36),
  T: new pc.Color(0.78, 0.46, 0.92),
  S: new pc.Color(0.46, 0.86, 0.56),
  Z: new pc.Color(0.96, 0.46, 0.46),
  J: new pc.Color(0.40, 0.56, 0.96),
  L: new pc.Color(0.98, 0.66, 0.40),
};

const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const KEYS = Object.keys(PIECES);

function rotateCW(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  const out = Array.from({ length: w }, () => new Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[x][h - 1 - y] = matrix[y][x];
    }
  }
  return out;
}

function emptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

function shapeCells(matrix, ox, oy) {
  const cells = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      if (matrix[y][x]) cells.push([ox + x, oy + y]);
    }
  }
  return cells;
}

function canPlace(board, matrix, ox, oy) {
  for (const [x, y] of shapeCells(matrix, ox, oy)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y][x] !== null) return false;
  }
  return true;
}

function spawnPiece() {
  const k = KEYS[Math.floor(Math.random() * KEYS.length)];
  const shape = PIECES[k].map((row) => row.slice());
  return {
    key: k,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: -shape.length,
  };
}

function lockPiece(board, piece) {
  let topOut = false;
  for (const [x, y] of shapeCells(piece.shape, piece.x, piece.y)) {
    if (y < 0) {
      topOut = true;
      continue;
    }
    board[y][x] = piece.key;
  }
  return !topOut;
}

function clearLines(board) {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((c) => c !== null)) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function ghostY(board, piece) {
  let y = piece.y;
  while (canPlace(board, piece.shape, piece.x, y + 1)) y += 1;
  return y;
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("app"));
const stage = document.getElementById("stage");

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

const materials = new Map();
function getMaterial(color) {
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

const cellEntities = [];
for (let y = 0; y < ROWS; y++) {
  cellEntities.push([]);
  for (let x = 0; x < COLS; x++) {
    const e = new pc.Entity();
    e.addComponent("render", { type: "box" });
    e.setLocalScale(0.92, 0.92, 0.92);
    e.setPosition(xOffset + x, yOffset - y, 0);
    e.render.material = getMaterial(COLORS.empty);
    app.root.addChild(e);
    cellEntities[y].push(e);
  }
}

(function makeBorder() {
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
    e.render.material = getMaterial(COLORS.border);
    app.root.addChild(e);
  }
})();

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");

let board = emptyBoard();
let piece = spawnPiece();
let dropAccumulator = 0;
let dropInterval = 0.7;
let score = 0;
let lines = 0;
let level = 1;
let gameOver = false;
let paused = false;

function updateHud() {
  if (scoreEl) scoreEl.textContent = String(score);
  if (linesEl) linesEl.textContent = String(lines);
  if (levelEl) levelEl.textContent = String(level);
}

function showOverlay(msg) {
  if (!overlayEl || !overlayMsg) return;
  overlayMsg.textContent = msg;
  overlayEl.hidden = false;
}

function hideOverlay() {
  if (overlayEl) overlayEl.hidden = true;
}

function newGame() {
  board = emptyBoard();
  piece = spawnPiece();
  dropAccumulator = 0;
  dropInterval = 0.7;
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  paused = false;
  hideOverlay();
  updateHud();
}

function tryMove(dx, dy) {
  if (canPlace(board, piece.shape, piece.x + dx, piece.y + dy)) {
    piece.x += dx;
    piece.y += dy;
    return true;
  }
  return false;
}

function tryRotate() {
  const r = rotateCW(piece.shape);
  for (const dx of [0, -1, 1, -2, 2]) {
    if (canPlace(board, r, piece.x + dx, piece.y)) {
      piece.shape = r;
      piece.x += dx;
      return;
    }
  }
}

function softDrop() {
  if (tryMove(0, 1)) {
    score += 1;
  } else {
    settle();
  }
}

function hardDrop() {
  let dropped = 0;
  while (tryMove(0, 1)) dropped += 1;
  score += dropped * 2;
  settle();
}

function settle() {
  const ok = lockPiece(board, piece);
  if (!ok) {
    endGame();
    return;
  }
  const cleared = clearLines(board);
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] ?? 1000;
    score += points * level;
    lines += cleared;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = Math.max(0.07, 0.7 * Math.pow(0.85, level - 1));
    }
  }
  piece = spawnPiece();
  if (!canPlace(board, piece.shape, piece.x, piece.y)) {
    endGame();
  }
  updateHud();
}

function endGame() {
  gameOver = true;
  showOverlay("Game over — press R to restart");
  updateHud();
}

window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "r" || k === "R") {
    newGame();
    e.preventDefault();
    return;
  }
  if (gameOver) return;
  if (k === "p" || k === "P") {
    paused = !paused;
    if (paused) showOverlay("Paused — press P to resume");
    else hideOverlay();
    e.preventDefault();
    return;
  }
  if (paused) return;
  if (k === "ArrowLeft") {
    tryMove(-1, 0);
    e.preventDefault();
  } else if (k === "ArrowRight") {
    tryMove(1, 0);
    e.preventDefault();
  } else if (k === "ArrowDown") {
    softDrop();
    updateHud();
    e.preventDefault();
  } else if (k === "ArrowUp" || k === "x" || k === "X") {
    tryRotate();
    e.preventDefault();
  } else if (k === " ") {
    hardDrop();
    updateHud();
    e.preventDefault();
  }
});

function renderBoard() {
  const ghostPos = canPlace(board, piece.shape, piece.x, piece.y)
    ? ghostY(board, piece)
    : piece.y;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const k = board[y][x];
      cellEntities[y][x].render.material = getMaterial(k ? COLORS[k] : COLORS.empty);
    }
  }

  for (const [x, y] of shapeCells(piece.shape, piece.x, ghostPos)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS && board[y][x] === null) {
      cellEntities[y][x].render.material = getMaterial(COLORS.ghost);
    }
  }

  for (const [x, y] of shapeCells(piece.shape, piece.x, piece.y)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      cellEntities[y][x].render.material = getMaterial(COLORS[piece.key]);
    }
  }
}

app.on("update", (dt) => {
  if (!gameOver && !paused) {
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

function fitToStage() {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  app.resizeCanvas(w, h);
  const aspect = w / h;
  const minBoardW = COLS + 1.6;
  const minBoardH = ROWS + 1.6;
  const oh = Math.max(minBoardH / 2, minBoardW / 2 / aspect);
  camera.camera.orthoHeight = oh;
}

window.addEventListener("resize", fitToStage);
const ro = new ResizeObserver(fitToStage);
ro.observe(stage);

fitToStage();
updateHud();
app.start();
