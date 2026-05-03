import {
  DESIGN,
  DINO_LEVELS,
  applyDinoHit,
  applyDinoScore,
  clampDinoLevel,
  createDinoState,
  dinoLevelById,
  levelMinGap,
  levelSpeed,
  obstacleBox,
  playerBox,
  readDinoBest,
  readDinoUnlocked,
  recordDinoBest,
  startLevelRun,
  startRun,
  tickDino,
  unlockNextDinoLevel,
  type DinoLevelDef,
  type DinoState,
  type LevelRunState,
  type StorageLike,
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

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const hudLevelEl = document.getElementById("hudLevel");
const hudGoalEl = document.getElementById("hudGoal");
const hudHpEl = document.getElementById("hudHp");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const overlayHint = document.getElementById("overlayHint");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlayPrimary = document.getElementById("overlayPrimaryBtn") as HTMLButtonElement | null;
const overlaySecondary = document.getElementById("overlaySecondaryBtn") as HTMLButtonElement | null;
const levelSelectEl = document.getElementById("levelSelect");
const levelGridEl = document.getElementById("levelGrid");
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

let unlocked = clampDinoLevel(readDinoUnlocked(STORAGE));
let currentLevel: DinoLevelDef = dinoLevelById(unlocked) ?? dinoLevelById(1)!;
let state: DinoState = createDinoState(0);
let levelRun: LevelRunState = startLevelRun(currentLevel.id);
let totalObstaclesPassed = 0;
let phase: "select" | "running" | "complete" | "failed" | "paused" = "select";
let jumpQueued = false;
let paused = false;
const keys = { ArrowDown: false };

let awaitingSetupDismiss = true;

migrateDropPackSkinPreference();

let dinoPalette: DinoPalette = (() => {
  const body = loadStoredDinoColor();
  return { body, shade: shadeFromBody(body) };
})();

const rng = (): number => Math.random();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setHud(): void {
  if (hudLevelEl) hudLevelEl.textContent = String(currentLevel.id);
  if (hudGoalEl) hudGoalEl.textContent = `${levelRun.score}/${levelRun.goal}`;
  if (hudHpEl) hudHpEl.textContent = "♥".repeat(Math.max(0, levelRun.hp));
  if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
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
  if (overlayEyebrow) overlayEyebrow.textContent = opts.eyebrow ?? "Dino Run";
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

function syncChangeColorButton(): void {
  if (!changeColorBtn) return;
  const showChange =
    !awaitingSetupDismiss &&
    !!(overlayEl && !overlayEl.hidden) &&
    (phase === "select" || phase === "complete" || phase === "failed");
  changeColorBtn.hidden = !showChange;
}

function renderLevelGrid(): void {
  if (!levelGridEl) return;
  const best = readDinoBest(STORAGE);
  levelGridEl.innerHTML = DINO_LEVELS.map((lv) => {
    const isLocked = lv.id > unlocked;
    const cleared = lv.id < unlocked;
    const classes = ["shLevelCard"];
    if (lv.id === currentLevel.id) classes.push("shLevelCard--current");
    if (cleared) classes.push("shLevelCard--cleared");
    const meta = isLocked
      ? "Locked"
      : `${lv.goalScore} obstacles${best[lv.id] ? ` · best ${best[lv.id]}` : ""}`;
    const disabled = isLocked ? "disabled" : "";
    return `
      <button type="button" class="${classes.join(" ")}" data-level="${lv.id}" ${disabled} aria-label="Level ${lv.id} ${lv.name}">
        <span class="shLevelCardId">Lv ${lv.id}</span>
        <span class="shLevelCardName">${escapeHtml(lv.name)}</span>
        <span class="shLevelCardMeta">${meta}</span>
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

function showLevelSelect(): void {
  phase = "select";
  paused = false;
  setHud();
  renderLevelGrid();
  setOverlay({
    visible: true,
    eyebrow: "Dino Run",
    message: "Pick a level",
    hint: `Cleared up to ${unlocked}/${DINO_LEVELS.length}.`,
    showLevelSelect: true,
    primaryLabel: `Continue (Lv ${unlocked})`,
    secondaryLabel: null,
  });
  syncChangeColorButton();
}

function applyTheme(level: DinoLevelDef): void {
  document.documentElement.style.setProperty("--accent", level.palette.accent);
}

function startLevel(id: number): void {
  if (awaitingSetupDismiss) return;
  const def = dinoLevelById(clampDinoLevel(id));
  if (!def) return;
  if (def.id > unlocked) return;
  currentLevel = def;
  applyTheme(def);
  levelRun = startLevelRun(def.id);
  totalObstaclesPassed = 0;
  state = startRun({ ...createDinoState(state.best), best: state.best });
  phase = "running";
  paused = false;
  jumpQueued = false;
  keys.ArrowDown = false;
  setHud();
  setOverlay({ visible: false });
  syncPauseButton();
}

function failLevel(reason: string): void {
  phase = "failed";
  paused = false;
  recordDinoBest(STORAGE, currentLevel.id, levelRun.score);
  setOverlay({
    visible: true,
    eyebrow: "Failed",
    message: `${currentLevel.name} — ${levelRun.score}/${levelRun.goal}`,
    hint: reason,
    showLevelSelect: false,
    primaryLabel: "Retry",
    secondaryLabel: "Levels",
  });
  syncPauseButton();
  syncChangeColorButton();
}

function clearLevel(): void {
  phase = "complete";
  paused = false;
  recordDinoBest(STORAGE, currentLevel.id, levelRun.score);
  unlocked = unlockNextDinoLevel(STORAGE, currentLevel.id);
  const isFinal = currentLevel.id === DINO_LEVELS.length;
  setOverlay({
    visible: true,
    eyebrow: isFinal ? "Campaign cleared" : "Level cleared",
    message: `${currentLevel.name} — ${levelRun.score} obstacles`,
    hint: isFinal
      ? "Pick any level to chase a high score."
      : `Next: ${dinoLevelById(currentLevel.id + 1)?.name ?? ""}.`,
    showLevelSelect: false,
    primaryLabel: isFinal ? "Levels" : "Next level",
    secondaryLabel: "Levels",
  });
  syncPauseButton();
  syncChangeColorButton();
}

function syncPauseButton(): void {
  if (pauseBtn) {
    pauseBtn.hidden = phase !== "running";
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
  if (phase !== "running" || paused) return;
  setPaused(true);
}

function closePause(): void {
  if (!paused) return;
  setPaused(false);
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
  showLevelSelect();
}

function reopenColourSetup(): void {
  if (phase === "running") return;
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

function handleOverlayPrimary(): void {
  if (awaitingSetupDismiss) return;
  if (phase === "select") {
    startLevel(unlocked);
    return;
  }
  if (phase === "complete") {
    if (currentLevel.id < DINO_LEVELS.length) startLevel(currentLevel.id + 1);
    else showLevelSelect();
    return;
  }
  if (phase === "failed") {
    startLevel(currentLevel.id);
    return;
  }
}

function handleOverlaySecondary(): void {
  showLevelSelect();
}

function onPointerPrimary(): void {
  if (awaitingSetupDismiss) return;
  if (paused) return;
  if (phase === "running") {
    jumpQueued = true;
  } else if (phase === "select" || phase === "complete" || phase === "failed") {
    handleOverlayPrimary();
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
  if (e.key === "Escape") {
    e.preventDefault();
    if (phase === "running") openPause();
    else showLevelSelect();
    return;
  }
  if ((e.key === "p" || e.key === "P") && phase === "running") {
    e.preventDefault();
    openPause();
    return;
  }
  if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    if (phase === "running") {
      jumpQueued = true;
    } else {
      handleOverlayPrimary();
    }
  }
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    keys.ArrowDown = true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    handleOverlayPrimary();
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
    if (phase === "running" && !paused) openPause();
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

if (overlayPrimary) {
  overlayPrimary.addEventListener("click", (e) => {
    e.preventDefault();
    handleOverlayPrimary();
  });
}
if (overlaySecondary) {
  overlaySecondary.addEventListener("click", (e) => {
    e.preventDefault();
    handleOverlaySecondary();
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
    if (phase === "running") {
      jumpQueued = true;
    } else {
      handleOverlayPrimary();
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

function drawWeather(g: CanvasRenderingContext2D, level: DinoLevelDef, time: number): void {
  const { CANVAS_W, CANVAS_H } = DESIGN;
  if (level.weather === "clear") return;
  g.save();
  if (level.weather === "fog") {
    g.fillStyle = "rgba(220, 230, 240, 0.18)";
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (level.weather === "drizzle" || level.weather === "storm") {
    g.strokeStyle = level.weather === "storm" ? "rgba(180, 200, 240, 0.5)" : "rgba(180, 200, 240, 0.32)";
    g.lineWidth = level.weather === "storm" ? 1.6 : 1.1;
    const count = level.weather === "storm" ? 70 : 36;
    for (let i = 0; i < count; i++) {
      const seed = (i * 47.13 + time * 800) % CANVAS_W;
      const y = ((i * 31.7 + time * 1100) % CANVAS_H) | 0;
      g.beginPath();
      g.moveTo(seed, y);
      g.lineTo(seed - 6, y + 14);
      g.stroke();
    }
  } else if (level.weather === "sandstorm") {
    g.fillStyle = "rgba(220, 170, 110, 0.22)";
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    g.fillStyle = "rgba(255, 200, 130, 0.18)";
    for (let i = 0; i < 22; i++) {
      const x = ((i * 53 + time * 320) % CANVAS_W) | 0;
      const y = ((i * 41 + time * 90) % CANVAS_H) | 0;
      g.fillRect(x, y, 26, 2);
    }
  } else if (level.weather === "night") {
    g.fillStyle = "rgba(8, 12, 26, 0.45)";
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  g.restore();
}

function drawBoss(g: CanvasRenderingContext2D, level: DinoLevelDef, time: number): void {
  if (level.modifier !== "boss") return;
  const { CANVAS_W } = DESIGN;
  const cx = CANVAS_W * 0.78 + Math.sin(time * 1.4) * 24;
  const cy = 70 + Math.cos(time * 0.9) * 14;
  g.save();
  g.fillStyle = "rgba(255, 80, 110, 0.92)";
  g.beginPath();
  g.ellipse(cx, cy, 36, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255, 200, 220, 0.85)";
  g.beginPath();
  g.ellipse(cx + 14, cy - 5, 14, 6, 0, 0, Math.PI * 2);
  g.fill();
  // wings
  const flap = (Math.sin(time * 6) + 1) * 0.5;
  g.strokeStyle = "rgba(255, 120, 150, 0.75)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx - 30, cy);
  g.lineTo(cx - 60, cy - 18 - flap * 12);
  g.lineTo(cx - 30, cy + 4);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 30, cy);
  g.lineTo(cx + 60, cy - 18 - flap * 12);
  g.lineTo(cx + 30, cy + 4);
  g.stroke();
  g.restore();
}

function draw(s: DinoState): void {
  const g = ctx;
  if (!g) return;
  const { CANVAS_W, CANVAS_H, GROUND_Y } = DESIGN;
  const scroll = s.runTime * s.speed * 0.11;

  drawChromeSkyBackdrop(g, CANVAS_W, GROUND_Y, scroll);
  drawChromeDesertFloor(g, CANVAS_W, CANVAS_H, GROUND_Y, scroll);
  drawChromeHorizon(g, CANVAS_W, GROUND_Y, scroll);

  drawBoss(g, currentLevel, s.runTime);

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

  drawWeather(g, currentLevel, s.runTime);
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

  if (phase === "running" && !paused) {
    const prevScore = state.score;
    state = tickDino(
      state,
      dt,
      { wantJump: jumpQueued, duck: keys.ArrowDown },
      rng,
    );
    jumpQueued = false;

    // Apply level speed/gap modifiers retroactively (simple): cap speed
    if (state.speed > 0) {
      state = { ...state, speed: levelSpeed(currentLevel, state.score) };
    }

    if (state.score !== prevScore) {
      const delta = Math.max(0, Math.floor(state.score) - Math.floor(prevScore));
      if (delta > 0) {
        totalObstaclesPassed += delta;
        levelRun = applyDinoScore(levelRun, totalObstaclesPassed);
        setHud();
        if (levelRun.cleared) {
          clearLevel();
        }
      }
    }

    if (state.phase === "dead") {
      // Apply HP. If still alive, respawn immediately.
      const updated = applyDinoHit(levelRun);
      levelRun = updated;
      setHud();
      if (updated.failed) {
        failLevel("Out of HP — try again.");
      } else {
        // Respawn: keep best, reset state but maintain levelRun.score progression.
        const best = state.best;
        state = startRun({ ...createDinoState(best), best });
        keys.ArrowDown = false;
      }
    }
    // We use levelMinGap implicitly by tightening spawn timing via speed bumps above.
    void levelMinGap;
  }

  syncCanvasLayout();
  draw(state);
  requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(stage);
window.addEventListener("resize", resize);

setHud();
initColorPicker();
syncPauseButton();
syncChangeColorButton();
resize();
applyTheme(currentLevel);
(window as Window & { __dinoReady?: boolean }).__dinoReady = true;
requestAnimationFrame(frame);

interface DinoTestApi {
  start(level?: number): void;
  scoreTo(score: number): { cleared: boolean; failed: boolean };
  state(): { level: number; score: number; goal: number; cleared: boolean; failed: boolean; hp: number };
}

(window as unknown as { __dinoTest?: DinoTestApi }).__dinoTest = {
  start(level = 1) {
    awaitingSetupDismiss = false;
    if (setupOverlay) setupOverlay.hidden = true;
    unlocked = clampDinoLevel(Math.max(unlocked, level));
    startLevel(level);
  },
  scoreTo(score) {
    levelRun = applyDinoScore(levelRun, score);
    setHud();
    if (levelRun.cleared) clearLevel();
    return { cleared: levelRun.cleared, failed: levelRun.failed };
  },
  state() {
    return {
      level: currentLevel.id,
      score: levelRun.score,
      goal: levelRun.goal,
      cleared: levelRun.cleared,
      failed: levelRun.failed,
      hp: levelRun.hp,
    };
  },
};
