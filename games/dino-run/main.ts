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
  DINO_SKIN_BLEND_FILES,
  DINO_SKIN_IDS,
  DINO_SKIN_LABELS,
  type DinoSkinId,
  drawSkinDino,
  loadPreviewSprites,
  loadStoredSkin,
  previewSpriteHref,
  storeSkin,
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
const skinGrid = document.getElementById("skinGrid");
const changeDinoBtn = document.getElementById("changeDinoBtn");

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
let selectedSkin: DinoSkinId = loadStoredSkin();

const rng = (): number => Math.random();

function setHud(): void {
  if (bestEl) bestEl.textContent = String(state.best);
  if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
}

function showOverlay(msg: string): void {
  if (overlayMsg) overlayMsg.textContent = msg;
  if (overlayEl) overlayEl.hidden = false;
  syncChangeDinoButton();
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
  syncChangeDinoButton();
}

function syncChangeDinoButton(): void {
  if (!changeDinoBtn) return;
  const showChange =
    !awaitingSetupDismiss &&
    !!(overlayEl && !overlayEl.hidden) &&
    (state.phase === "idle" || state.phase === "dead") &&
    !paused;
  changeDinoBtn.hidden = !showChange;
}

function populateSkinCards(): void {
  if (!skinGrid) return;
  skinGrid.replaceChildren();
  for (const id of DINO_SKIN_IDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skinCard";
    btn.setAttribute("data-skin", id);
    btn.setAttribute("aria-label", `${DINO_SKIN_LABELS[id]}, ${DINO_SKIN_BLEND_FILES[id]}`);
    const thumb = document.createElement("img");
    thumb.className = "skinCardThumb";
    thumb.alt = "";
    thumb.src = previewSpriteHref(id, "run-0");
    thumb.loading = "lazy";
    const title = document.createElement("span");
    title.className = "skinCardTitle";
    title.textContent = DINO_SKIN_LABELS[id];
    const file = document.createElement("span");
    file.className = "skinCardFile";
    file.textContent = DINO_SKIN_BLEND_FILES[id];
    btn.append(thumb, title, file);
    btn.addEventListener("click", () => selectSkinUi(id));
    skinGrid.appendChild(btn);
  }
  applySkinHighlight();
}

function selectSkinUi(id: DinoSkinId): void {
  selectedSkin = id;
  applySkinHighlight();
}

function applySkinHighlight(): void {
  if (!skinGrid) return;
  for (const el of skinGrid.querySelectorAll<HTMLButtonElement>(".skinCard")) {
    const id = el.getAttribute("data-skin") as DinoSkinId;
    el.setAttribute("aria-pressed", id === selectedSkin ? "true" : "false");
  }
}

function finishSetupProceedToGame(): void {
  if (!awaitingSetupDismiss) return;
  awaitingSetupDismiss = false;
  storeSkin(selectedSkin);
  if (setupOverlay) setupOverlay.hidden = true;
  showOverlay("Space or tap to start");
  syncChangeDinoButton();
}

function reopenSkinChooser(): void {
  if (state.phase === "running") return;
  awaitingSetupDismiss = true;
  setPaused(false);
  if (overlayEl) overlayEl.hidden = true;
  if (setupOverlay) setupOverlay.hidden = false;
  applySkinHighlight();
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
    syncChangeDinoButton();
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

if (changeDinoBtn) {
  changeDinoBtn.addEventListener("click", (e) => {
    e.preventDefault();
    reopenSkinChooser();
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
  drawSkinDino(g, pb, selectedSkin, s.phase, s.grounded, s.isDuck, s.runTime);
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
      syncChangeDinoButton();
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
populateSkinCards();
syncPauseButton();
syncChangeDinoButton();
resize();
(window as Window & { __dinoReady?: boolean }).__dinoReady = true;
void loadPreviewSprites();
requestAnimationFrame(frame);
