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
  drawChromeBird,
  drawChromeCactus,
  drawChromeDesertFloor,
  drawChromeHorizon,
  drawChromeSkyBackdrop,
} from "./chrome-sprites";
import {
  DEFAULT_DINO_BODY,
  drawSkinDino,
  loadStoredDinoColor,
  migrateDropPackSkinPreference,
  shadeFromBody,
  storeDinoColor,
  type DinoPalette,
} from "./dino-skins";

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
const setupOverlay = document.getElementById("setupOverlay");
const setupContinue = document.getElementById("setupContinue");
const dinoColorInput = document.getElementById("dinoColor") as HTMLInputElement | null;
const changeColorBtn = document.getElementById("changeColorBtn");

if (!canvas || !stage) {
  throw new Error("Dino: missing canvas or stage");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Dino: 2D context not available");

let state: DinoState = createDinoState(getStoredBest());
let jumpQueued = false;
let paused = false;
const keys = { ArrowDown: false };

/** Setup screen gates the start overlay until Continue is pressed */
let awaitingSetupDismiss = true;

migrateDropPackSkinPreference();

let dinoPalette: DinoPalette = (() => {
  const body = loadStoredDinoColor();
  return { body, shade: shadeFromBody(body) };
})();

const rng = (): number => Math.random();

function setHud(): void {
  if (bestEl) bestEl.textContent = String(state.best);
  if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
}

function showOverlay(msg: string): void {
  if (overlayMsg) overlayMsg.textContent = msg;
  if (overlayEl) overlayEl.hidden = false;
  syncChangeColorButton();
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
  syncChangeColorButton();
}

function syncChangeColorButton(): void {
  if (!changeColorBtn) return;
  const showChange =
    !awaitingSetupDismiss &&
    !!(overlayEl && !overlayEl.hidden) &&
    (state.phase === "idle" || state.phase === "dead") &&
    !paused;
  changeColorBtn.hidden = !showChange;
}

function initColorPicker(): void {
  if (!dinoColorInput) return;
  dinoColorInput.value = /^#[0-9a-f]{6}$/i.test(dinoPalette.body)
    ? dinoPalette.body
    : DEFAULT_DINO_BODY;

  const applyFromInput = (): void => {
    dinoPalette = { body: dinoColorInput.value, shade: shadeFromBody(dinoColorInput.value) };
  };
  dinoColorInput.addEventListener("input", applyFromInput);
}

function finishSetupProceedToGame(): void {
  if (!awaitingSetupDismiss) return;
  awaitingSetupDismiss = false;
  storeDinoColor(dinoPalette.body);
  if (setupOverlay) setupOverlay.hidden = true;
  showOverlay("Space or tap to start");
  syncChangeColorButton();
}

function reopenColourSetup(): void {
  if (state.phase === "running") return;
  awaitingSetupDismiss = true;
  setPaused(false);
  if (overlayEl) overlayEl.hidden = true;
  if (setupOverlay) setupOverlay.hidden = false;
  if (dinoColorInput) {
    dinoColorInput.value = /^#[0-9a-f]{6}$/i.test(dinoPalette.body)
      ? dinoPalette.body
      : DEFAULT_DINO_BODY;
    dinoPalette = { body: dinoColorInput.value, shade: shadeFromBody(dinoColorInput.value) };
  }
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
  if (awaitingSetupDismiss) return;
  if (state.phase === "idle" || state.phase === "dead") {
    setPaused(false);
    state = startRun(state);
    setHud();
    hideOverlay();
    syncPauseButton();
    syncChangeColorButton();
  }
}

function onPointerPrimary(): void {
  if (awaitingSetupDismiss) return;
  if (paused) return;
  if (state.phase === "running") {
    jumpQueued = true;
  } else {
    handleStartOrRestart();
  }
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (!setupOverlay?.hidden) {
    if (e.key === " " || e.key === "Enter") e.preventDefault();
    if (e.key === "Enter") finishSetupProceedToGame();
    return;
  }

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
    if (awaitingSetupDismiss) return;
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
    if (awaitingSetupDismiss) return;
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

if (setupContinue) {
  setupContinue.addEventListener("click", (e) => {
    e.preventDefault();
    finishSetupProceedToGame();
  });
}

if (changeColorBtn) {
  changeColorBtn.addEventListener("click", (e) => {
    e.preventDefault();
    reopenColourSetup();
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
    if (awaitingSetupDismiss) return;
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
    if (awaitingSetupDismiss) return;
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

function draw(s: DinoState): void {
  const g = ctx;
  if (!g) return;
  const { CANVAS_W, CANVAS_H, GROUND_Y } = DESIGN;
  const scroll = s.runTime * s.speed * 0.11;

  drawChromeSkyBackdrop(g, CANVAS_W, GROUND_Y, scroll);
  drawChromeDesertFloor(g, CANVAS_W, CANVAS_H, GROUND_Y, scroll);
  drawChromeHorizon(g, CANVAS_W, GROUND_Y, scroll);

  for (const o of s.obstacles) {
    const b = obstacleBox(o, GROUND_Y);
    if (o.kind === "cactus") {
      drawChromeCactus(g, b);
    } else {
      drawChromeBird(g, b, s.runTime, o.id);
    }
  }

  const pb = playerBox(s.playerTop, s.isDuck);
  drawSkinDino(g, pb, dinoPalette, s.phase, s.grounded, s.isDuck, s.runTime);
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
      syncChangeColorButton();
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
initColorPicker();
syncPauseButton();
syncChangeColorButton();
resize();
(window as Window & { __dinoReady?: boolean }).__dinoReady = true;
requestAnimationFrame(frame);
