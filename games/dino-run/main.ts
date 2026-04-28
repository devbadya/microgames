import {
  createDinoState,
  startRun,
  tickDino,
  playerBox,
  obstacleBox,
  DESIGN,
  type DinoState,
} from "./dino-logic";
import {
  CHROME,
  drawChromeDino,
  drawChromeBird,
  drawChromeCactus,
  drawChromeCloud,
} from "./chrome-sprites";

const LS_KEY = "microgames.dinoRun.best";

function getStoredBest(): number {
  const raw = window.localStorage.getItem(LS_KEY);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function storeBest(v: number): void {
  window.localStorage.setItem(LS_KEY, String(v));
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const pauseBtn = document.getElementById("pauseBtn");
const pauseOverlay = document.getElementById("pauseOverlay");
const pauseContinue = document.getElementById("pauseContinue");

if (!canvas || !stage) {
  throw new Error("Dino: missing canvas or stage");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Dino: 2D context not available");

let state: DinoState = createDinoState(getStoredBest());
let jumpQueued = false;
let paused = false;
const keys = { ArrowDown: false };

const rng = (): number => Math.random();

function setHud(): void {
  if (bestEl) bestEl.textContent = String(state.best);
  if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
}

function showOverlay(msg: string): void {
  if (overlayMsg) overlayMsg.textContent = msg;
  if (overlayEl) overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function syncPauseButton(): void {
  if (pauseBtn) {
    pauseBtn.hidden = state.phase !== "running";
  }
}

function setPaused(value: boolean): void {
  paused = value;
  if (pauseOverlay) pauseOverlay.hidden = !value;
  if (value) {
    keys.ArrowDown = false;
    queueMicrotask(() => pauseContinue?.focus());
  }
}

function openPause(): void {
  if (state.phase !== "running" || paused) return;
  setPaused(true);
}

function closePause(): void {
  if (!paused) return;
  setPaused(false);
}

function handleStartOrRestart(): void {
  if (state.phase === "idle" || state.phase === "dead") {
    setPaused(false);
    state = startRun(state);
    setHud();
    hideOverlay();
    syncPauseButton();
  }
}

function onPointerPrimary(): void {
  if (paused) return;
  if (state.phase === "running") {
    jumpQueued = true;
  } else {
    handleStartOrRestart();
  }
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (paused) {
    if (e.key === " " || e.key === "Enter" || e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      closePause();
    }
    return;
  }
  if ((e.key === "p" || e.key === "P" || e.key === "Escape") && state.phase === "running") {
    e.preventDefault();
    openPause();
    return;
  }
  if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    if (state.phase === "running") {
      jumpQueued = true;
    } else {
      handleStartOrRestart();
    }
  }
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    keys.ArrowDown = true;
  }
  if (e.key === "Enter" && (state.phase === "idle" || state.phase === "dead")) {
    e.preventDefault();
    handleStartOrRestart();
  }
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    keys.ArrowDown = false;
  }
});

if (pauseBtn) {
  pauseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (state.phase === "running" && !paused) openPause();
  });
}

if (pauseContinue) {
  pauseContinue.addEventListener("click", (e) => {
    e.preventDefault();
    closePause();
  });
}

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.target instanceof HTMLButtonElement) return;
  if (e.target instanceof HTMLAnchorElement) return;
  e.preventDefault();
  onPointerPrimary();
});

const touchJump = document.getElementById("touchJump");
if (touchJump) {
  touchJump.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (paused) return;
    if (state.phase === "running") {
      jumpQueued = true;
    } else {
      handleStartOrRestart();
    }
  });
}

const touchDuck = document.getElementById("touchDuck");
if (touchDuck) {
  touchDuck.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (paused) return;
    keys.ArrowDown = true;
  });
  const endDuck = (): void => {
    keys.ArrowDown = false;
  };
  touchDuck.addEventListener("pointerup", endDuck);
  touchDuck.addEventListener("pointercancel", endDuck);
  touchDuck.addEventListener("pointerleave", endDuck);
}

let lastT = 0;

function syncCanvasLayout(): void {
  const c = ctx;
  if (!c) return;
  const rw = canvas.width;
  const rh = canvas.height;
  const scale = Math.min(rw / DESIGN.CANVAS_W, rh / DESIGN.CANVAS_H);
  const ox = (rw - DESIGN.CANVAS_W * scale) / 2;
  const oy = (rh - DESIGN.CANVAS_H * scale) / 2;
  c.setTransform(scale, 0, 0, scale, ox, oy);
  c.imageSmoothingEnabled = false;
}

/** Sky + slow clouds like Chrome’s offline page. */
function drawChromeSky(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  GROUND_Y: number,
  scroll: number,
): void {
  g.fillStyle = CHROME.sky;
  g.fillRect(0, 0, CANVAS_W, GROUND_Y);

  const seeds = [
    [40, 28, 84, 22],
    [220, 44, 72, 18],
    [420, 32, 90, 26],
    [640, 48, 68, 20],
  ] as const;
  for (let i = 0; i < seeds.length; i++) {
    const [bx, by, bw, bh] = seeds[i];
    const sx = ((bx + scroll * (0.05 + i * 0.02)) % (CANVAS_W + bw + 40)) - 20;
    drawChromeCloud(g, sx, by, bw, bh);
  }
}

/** Pale strip under the horizon (slightly lighter than sky, like the original). */
function drawChromeGroundFill(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  CANVAS_H: number,
  GROUND_Y: number,
): void {
  g.fillStyle = CHROME.groundStripe;
  g.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
}

/** Scrolling dashed horizon line (#535353 segments with gaps). */
function drawChromeHorizon(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const dash = 14;
  const gap = 10;
  const cycle = dash + gap;
  const off = -((scroll * 0.85) % cycle);
  g.fillStyle = CHROME.horizon;
  for (let x = off; x < CANVAS_W + cycle; x += cycle) {
    g.fillRect(x, GROUND_Y - 1, dash, 2);
  }
}

function draw(s: DinoState): void {
  const g = ctx;
  if (!g) return;
  const { CANVAS_W, CANVAS_H, GROUND_Y } = DESIGN;
  const scroll = s.runTime * s.speed * 0.11;

  g.fillStyle = CHROME.sky;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawChromeSky(g, CANVAS_W, GROUND_Y, scroll);
  drawChromeGroundFill(g, CANVAS_W, CANVAS_H, GROUND_Y);
  drawChromeHorizon(g, CANVAS_W, GROUND_Y, scroll);

  for (const o of s.obstacles) {
    const b = obstacleBox(o, GROUND_Y);
    if (o.kind === "cactus") {
      drawChromeCactus(g, b);
    } else {
      drawChromeBird(g, b, scroll);
    }
  }

  const pb = playerBox(s.playerTop, s.isDuck);
  drawChromeDino(g, pb, s.phase, s.grounded, s.isDuck, s.runTime);
}

function resize(): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width = w;
  canvas.height = h;
}

function frame(now: number): void {
  const dt = lastT > 0 ? Math.min(0.05, (now - lastT) / 1000) : 0;
  lastT = now;

  if (state.phase === "running" && !paused) {
    const prevScore = state.score;
    state = tickDino(
      state,
      dt,
      { wantJump: jumpQueued, duck: keys.ArrowDown },
      rng,
    );
    jumpQueued = false;
    if (state.score !== prevScore && scoreEl) {
      scoreEl.textContent = String(Math.floor(state.score));
    }
    if (state.phase === "dead") {
      setPaused(false);
      storeBest(state.best);
      setHud();
      const pts = Math.floor(state.score);
      showOverlay(pts ? `${pts} pts — Space to restart` : "0 pts — Space to restart");
      syncPauseButton();
    }
  }

  syncCanvasLayout();
  draw(state);
  requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(stage);
window.addEventListener("resize", resize);

const bestStored = getStoredBest();
state = { ...state, best: Math.max(state.best, bestStored) };
setHud();
showOverlay("Space or tap to start");
syncPauseButton();
resize();
(window as Window & { __dinoReady?: boolean }).__dinoReady = true;
requestAnimationFrame(frame);
