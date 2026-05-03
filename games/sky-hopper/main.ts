import * as pc from "playcanvas";
import {
  LEVELS,
  clampLevel,
  failRun,
  gateGapSize,
  gateGapY,
  levelById,
  passGate,
  readBest,
  readUnlocked,
  recordBest,
  spawnGate,
  startRun,
  unlockNext,
  type GateSpec,
  type LevelDef,
  type RunState,
} from "./sky-logic";

const WORLD_HEIGHT = 10;
const WORLD_WIDTH = 16;
const BIRD_X = -4.7;
const BIRD_RADIUS = 0.38;
const GROUND_Y = -4.2;
const CEILING_Y = 4.4;
const PIPE_WIDTH = 1.15;

const COLORS = {
  bg: new pc.Color(0.035, 0.055, 0.095),
  bird: new pc.Color(0.98, 0.78, 0.30),
  wing: new pc.Color(1.0, 0.56, 0.42),
  beak: new pc.Color(1.0, 0.86, 0.36),
  pipe: new pc.Color(0.32, 0.86, 0.76),
  pipeCap: new pc.Color(0.45, 0.96, 0.86),
  pipeHazard: new pc.Color(0.96, 0.56, 0.84),
  pipeShifter: new pc.Color(0.74, 0.66, 1.0),
  spike: new pc.Color(1.0, 0.36, 0.46),
  ground: new pc.Color(0.12, 0.18, 0.28),
  cloud: new pc.Color(0.68, 0.76, 0.92),
  star: new pc.Color(0.78, 0.92, 1.0),
};

interface Pipe {
  x: number;
  spawnedAt: number;
  scored: boolean;
  spec: GateSpec;
  top: pc.Entity;
  topCap: pc.Entity;
  bottom: pc.Entity;
  bottomCap: pc.Entity;
  spikeTop: pc.Entity;
  spikeBottom: pc.Entity;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  entity: pc.Entity;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const hudLevelEl = document.getElementById("hudLevel");
const hudProgressEl = document.getElementById("hudProgress");
const hudBestEl = document.getElementById("hudBest");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const overlayHint = document.getElementById("overlayHint");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlayPrimary = document.getElementById("overlayPrimaryBtn") as HTMLButtonElement | null;
const overlaySecondary = document.getElementById("overlaySecondaryBtn") as HTMLButtonElement | null;
const levelGrid = document.getElementById("levelGrid");
const levelBar = document.getElementById("levelBar");
const levelBarFill = document.getElementById("levelBarFill");
const levelNameEl = document.getElementById("levelName");

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
  orthoHeight: WORLD_HEIGHT / 2,
  clearColor: COLORS.bg,
  nearClip: 0.1,
  farClip: 100,
});
camera.setPosition(0, 0, 30);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

function addLight(name: string, color: pc.Color, intensity: number, euler: [number, number, number]): void {
  const light = new pc.Entity(name);
  light.addComponent("light", { type: "directional", color, intensity });
  light.setEulerAngles(...euler);
  app.root.addChild(light);
}

addLight("keyLight", new pc.Color(1, 1, 1), 1.0, [45, 30, 0]);
addLight("fillLight", new pc.Color(0.55, 0.68, 1), 0.55, [-30, -40, 0]);
addLight("rimLight", new pc.Color(0.65, 1, 0.95), 0.35, [180, 0, 0]);

const materials = new Map<string, pc.StandardMaterial>();

function getMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const key = `${color.r.toFixed(3)}-${color.g.toFixed(3)}-${color.b.toFixed(3)}-${opacity}`;
  let material = materials.get(key);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0.04;
    material.gloss = 0.48;
    material.opacity = opacity;
    material.blendType = opacity < 1 ? pc.BLEND_NORMAL : pc.BLEND_NONE;
    material.update();
    materials.set(key, material);
  }
  return material;
}

function makeBox(
  name: string,
  color: pc.Color,
  scale: [number, number, number],
  position: [number, number, number],
  opacity = 1,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "box" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  app.root.addChild(entity);
  return entity;
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
  if (overlayEyebrow) overlayEyebrow.textContent = opts.eyebrow ?? "Sky Hopper";
  if (overlayMsg) overlayMsg.textContent = opts.message ?? "";
  if (overlayHint) overlayHint.textContent = opts.hint ?? "";
  const grid = document.getElementById("levelSelect");
  if (grid) grid.hidden = !opts.showLevelSelect;
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

function showOverlay(message: string): void {
  setOverlay({
    visible: true,
    eyebrow: "Game over",
    message,
    hint: "Tap or press Space to retry.",
    showLevelSelect: false,
    primaryLabel: "Retry",
    secondaryLabel: "Levels",
  });
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function localStorageOrFallback() {
  try {
    return window.localStorage;
  } catch {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
  }
}

const STORAGE = localStorageOrFallback();

function updateHud(): void {
  if (hudLevelEl) hudLevelEl.textContent = String(currentLevel.id);
  if (hudProgressEl) hudProgressEl.textContent = `${run.gatesPassed}/${run.goal}`;
  const best = (readBest(STORAGE)[currentLevel.id] ?? 0);
  if (hudBestEl) hudBestEl.textContent = String(best);
}

const skyPanel = makeBox("skyPanel", new pc.Color(0.05, 0.10, 0.19), [WORLD_WIDTH + 3, WORLD_HEIGHT + 2, 0.18], [0, 0, -1.8]);
skyPanel.render!.material = getMaterial(new pc.Color(0.05, 0.10, 0.19), 0.72);

const ground = makeBox("ground", COLORS.ground, [WORLD_WIDTH + 4, 1.05, 0.65], [0, GROUND_Y - 0.65, -0.1]);

const stars: pc.Entity[] = [];
for (let i = 0; i < 34; i++) {
  const x = -WORLD_WIDTH / 2 + Math.random() * WORLD_WIDTH;
  const y = -1.5 + Math.random() * 5.8;
  const s = 0.035 + Math.random() * 0.045;
  stars.push(makeBox(`star-${i}`, COLORS.star, [s, s, s], [x, y, -0.75], 0.55));
}

const clouds: Cloud[] = Array.from({ length: 5 }, (_, i) => {
  const cloud = makeBox(
    `cloud-${i}`,
    COLORS.cloud,
    [1.2 + Math.random() * 1.2, 0.34 + Math.random() * 0.22, 0.12],
    [-8 + i * 4.1, 2.4 + Math.random() * 1.5, -0.55],
    0.16,
  );
  return {
    x: -8 + i * 4.1,
    y: 2.4 + Math.random() * 1.5,
    speed: 0.22 + Math.random() * 0.18,
    entity: cloud,
  };
});

const bird = new pc.Entity("bird");
bird.addComponent("render", { type: "sphere" });
bird.setLocalScale(BIRD_RADIUS * 2, BIRD_RADIUS * 2, BIRD_RADIUS * 2);
bird.render!.material = getMaterial(COLORS.bird);
app.root.addChild(bird);

const wing = makeBox("wing", COLORS.wing, [0.44, 0.16, 0.08], [BIRD_X - 0.08, 0, 0.36]);
const beak = makeBox("beak", COLORS.beak, [0.28, 0.12, 0.10], [BIRD_X + 0.38, 0.03, 0.16]);

const pipes: Pipe[] = [];

function createPipe(): Pipe {
  return {
    x: WORLD_WIDTH,
    spawnedAt: 0,
    scored: false,
    spec: { gapY: 0, hazard: "static", amplitude: 0, omega: 0, shiftDir: 0, spikes: false },
    top: makeBox("topPipe", COLORS.pipe, [PIPE_WIDTH, 1, 0.55], [WORLD_WIDTH, 0, 0]),
    topCap: makeBox("topPipeCap", COLORS.pipeCap, [PIPE_WIDTH + 0.25, 0.28, 0.65], [WORLD_WIDTH, 0, 0.02]),
    bottom: makeBox("bottomPipe", COLORS.pipe, [PIPE_WIDTH, 1, 0.55], [WORLD_WIDTH, 0, 0]),
    bottomCap: makeBox("bottomPipeCap", COLORS.pipeCap, [PIPE_WIDTH + 0.25, 0.28, 0.65], [WORLD_WIDTH, 0, 0.02]),
    spikeTop: makeBox("spikeTop", COLORS.spike, [PIPE_WIDTH * 0.55, 0.18, 0.4], [WORLD_WIDTH, 0, 0.08]),
    spikeBottom: makeBox("spikeBottom", COLORS.spike, [PIPE_WIDTH * 0.55, 0.18, 0.4], [WORLD_WIDTH, 0, 0.08]),
  };
}

function colorForHazard(spec: GateSpec): pc.Color {
  if (spec.hazard === "shifter") return COLORS.pipeShifter;
  if (spec.hazard === "moving" || spec.hazard === "drift" || spec.hazard === "spike" || spec.hazard === "tight") {
    return COLORS.pipeHazard;
  }
  return COLORS.pipe;
}

function updatePipeEntities(pipe: Pipe, now: number): void {
  const t = Math.max(0, now - pipe.spawnedAt);
  const liveGapY = gateGapY(pipe.spec, pipe.spec.gapY, t);
  const gap = gateGapSize(pipe.spec, currentLevel.pipeGap);
  const topBottom = liveGapY + gap / 2;
  const bottomTop = liveGapY - gap / 2;
  const topHeight = Math.max(0.2, CEILING_Y - topBottom);
  const bottomHeight = Math.max(0.2, bottomTop - GROUND_Y);

  const baseMat = getMaterial(colorForHazard(pipe.spec));
  pipe.top.render!.material = baseMat;
  pipe.bottom.render!.material = baseMat;

  pipe.top.setLocalScale(PIPE_WIDTH, topHeight, 0.55);
  pipe.top.setPosition(pipe.x, topBottom + topHeight / 2, 0);
  pipe.topCap.setPosition(pipe.x, topBottom + 0.1, 0.02);

  pipe.bottom.setLocalScale(PIPE_WIDTH, bottomHeight, 0.55);
  pipe.bottom.setPosition(pipe.x, GROUND_Y + bottomHeight / 2, 0);
  pipe.bottomCap.setPosition(pipe.x, bottomTop - 0.1, 0.02);

  const showSpikes = pipe.spec.spikes;
  pipe.spikeTop.enabled = showSpikes;
  pipe.spikeBottom.enabled = showSpikes;
  if (showSpikes) {
    pipe.spikeTop.setPosition(pipe.x, topBottom + 0.05, 0.08);
    pipe.spikeBottom.setPosition(pipe.x, bottomTop - 0.05, 0.08);
  }
}

let currentLevel: LevelDef = levelById(1)!;
let run: RunState = startRun(1);
let unlocked = clampLevel(readUnlocked(STORAGE));

let birdY = 0;
let birdVelocity = 0;
let running = false;
let gameOver = false;
let levelFlowState: "idle" | "select" | "running" | "complete" | "failed" = "select";
let wingPhase = 0;
let timeNow = 0;

function syncBird(): void {
  const tilt = Math.max(-28, Math.min(28, birdVelocity * 4.2));
  bird.setPosition(BIRD_X, birdY, 0.1);
  bird.setEulerAngles(0, 0, tilt);
  wing.setPosition(BIRD_X - 0.12, birdY - 0.02 + Math.sin(wingPhase) * 0.06, 0.36);
  wing.setEulerAngles(0, 0, tilt - 12);
  beak.setPosition(BIRD_X + 0.39, birdY + 0.03, 0.16);
  beak.setEulerAngles(0, 0, tilt);
}

function ensurePipePool(): void {
  while (pipes.length < 4) pipes.push(createPipe());
}

function resetPipes(level: LevelDef): void {
  ensurePipePool();
  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i]!;
    pipe.x = 6.5 + i * level.pipeSpacing;
    pipe.spec = spawnGate(level, Math.random);
    pipe.spawnedAt = timeNow + i * 0.05;
    pipe.scored = false;
    updatePipeEntities(pipe, timeNow);
  }
}

function applyLevelTheme(level: LevelDef): void {
  document.documentElement.style.setProperty("--accent", level.palette.accent);
}

function setLevelBarVisible(v: boolean): void {
  if (!levelBar) return;
  levelBar.classList.toggle("is-visible", v);
}

function updateLevelBar(): void {
  if (levelNameEl) levelNameEl.textContent = `${currentLevel.id}. ${currentLevel.name}`;
  if (levelBarFill) {
    const pct = Math.min(100, Math.round((run.gatesPassed / run.goal) * 100));
    levelBarFill.style.width = `${pct}%`;
  }
}

function startLevel(id: number): void {
  const def = levelById(clampLevel(id));
  if (!def) return;
  if (def.id > unlocked) return;
  currentLevel = def;
  applyLevelTheme(def);
  run = startRun(def.id);
  birdY = 0;
  birdVelocity = 0;
  running = true;
  gameOver = false;
  levelFlowState = "running";
  resetPipes(def);
  updateHud();
  updateLevelBar();
  setLevelBarVisible(true);
  hideOverlay();
  syncBird();
}

function failLevel(): void {
  if (gameOver) return;
  running = false;
  gameOver = true;
  levelFlowState = "failed";
  run = failRun(run);
  recordBest(STORAGE, currentLevel.id, run.gatesPassed);
  updateHud();
  setLevelBarVisible(false);
  showOverlay(
    run.gatesPassed === 0
      ? `${currentLevel.name} — try again`
      : `${run.gatesPassed} gate${run.gatesPassed === 1 ? "" : "s"} on ${currentLevel.name}`,
  );
}

function clearLevel(): void {
  if (!running || gameOver) return;
  running = false;
  gameOver = true;
  levelFlowState = "complete";
  recordBest(STORAGE, currentLevel.id, run.gatesPassed);
  unlocked = unlockNext(STORAGE, currentLevel.id);
  updateHud();
  setLevelBarVisible(false);
  const isFinal = currentLevel.id === LEVELS.length;
  setOverlay({
    visible: true,
    eyebrow: isFinal ? "Campaign cleared" : "Level cleared",
    message: isFinal
      ? `${currentLevel.name} — you tamed the storm.`
      : `${currentLevel.name} cleared.`,
    hint: isFinal
      ? "Pick any level to chase a perfect run."
      : `Next: ${levelById(currentLevel.id + 1)?.name ?? ""}.`,
    showLevelSelect: false,
    primaryLabel: isFinal ? "Levels" : "Next level",
    secondaryLabel: "Levels",
  });
}

function flap(): void {
  if (levelFlowState === "select") return;
  if (!running || gameOver) {
    handleOverlayPrimary();
    return;
  }
  birdVelocity = currentLevel.flapVelocity;
}

function pipeCollides(pipe: Pipe, now: number): boolean {
  const birdLeft = BIRD_X - BIRD_RADIUS * 0.85;
  const birdRight = BIRD_X + BIRD_RADIUS * 0.85;
  const pipeLeft = pipe.x - PIPE_WIDTH / 2;
  const pipeRight = pipe.x + PIPE_WIDTH / 2;
  const overlapsX = birdRight > pipeLeft && birdLeft < pipeRight;
  if (!overlapsX) return false;
  const t = Math.max(0, now - pipe.spawnedAt);
  const liveGapY = gateGapY(pipe.spec, pipe.spec.gapY, t);
  const gap = gateGapSize(pipe.spec, currentLevel.pipeGap);
  const gapTop = liveGapY + gap / 2;
  const gapBottom = liveGapY - gap / 2;
  if (birdY + BIRD_RADIUS * 0.85 > gapTop) return true;
  if (birdY - BIRD_RADIUS * 0.85 < gapBottom) return true;
  if (pipe.spec.spikes) {
    const spikeBand = 0.18;
    if (Math.abs(birdY - gapTop) < spikeBand) return true;
    if (Math.abs(birdY - gapBottom) < spikeBand) return true;
  }
  return false;
}

function recyclePipe(pipe: Pipe): void {
  const rightMost = Math.max(...pipes.map((p) => p.x));
  pipe.x = rightMost + currentLevel.pipeSpacing;
  pipe.spec = spawnGate(currentLevel, Math.random);
  pipe.spawnedAt = timeNow;
  pipe.scored = false;
}

function updateScene(dt: number): void {
  wingPhase += dt * (running ? 12 : 4);
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * dt;
    if (cloud.x < -WORLD_WIDTH / 2 - 2) {
      cloud.x = WORLD_WIDTH / 2 + 2;
      cloud.y = 2.2 + Math.random() * 1.8;
    }
    cloud.entity.setPosition(cloud.x, cloud.y, -0.55);
  }
  for (const star of stars) {
    star.rotateLocal(0, 0, dt * 18);
  }
  ground.setPosition(Math.sin(performance.now() / 1600) * 0.04, GROUND_Y - 0.65, -0.1);
}

app.on("update", (dt: number) => {
  timeNow += dt;
  updateScene(dt);

  if (running && !gameOver) {
    birdVelocity += currentLevel.gravity * dt;
    birdY += birdVelocity * dt;

    if (birdY - BIRD_RADIUS <= GROUND_Y || birdY + BIRD_RADIUS >= CEILING_Y) {
      failLevel();
    }

    for (const pipe of pipes) {
      pipe.x -= currentLevel.pipeSpeed * dt;
      updatePipeEntities(pipe, timeNow);

      if (!pipe.scored && pipe.x < BIRD_X - PIPE_WIDTH / 2) {
        pipe.scored = true;
        run = passGate(run);
        updateHud();
        updateLevelBar();
        if (run.cleared) {
          clearLevel();
          break;
        }
      }

      if (pipeCollides(pipe, timeNow)) {
        failLevel();
      }

      if (pipe.x < -WORLD_WIDTH / 2 - 2) recyclePipe(pipe);
    }
  } else {
    for (const pipe of pipes) {
      updatePipeEntities(pipe, timeNow);
    }
  }

  syncBird();
});

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  app.resizeCanvas(w, h);

  const aspect = w / h;
  const minHeightFromWidth = WORLD_WIDTH / aspect;
  camera.camera!.orthoHeight = Math.max(WORLD_HEIGHT / 2, minHeightFromWidth / 2);
}

function renderLevelGrid(): void {
  if (!levelGrid) return;
  const best = readBest(STORAGE);
  const html = LEVELS.map((lv) => {
    const isLocked = lv.id > unlocked;
    const cleared = (best[lv.id] ?? 0) >= lv.goalGates;
    const classes = ["shLevelCard"];
    if (lv.id === currentLevel.id) classes.push("shLevelCard--current");
    if (cleared) classes.push("shLevelCard--cleared");
    const meta = isLocked ? "Locked" : `Goal ${lv.goalGates}`;
    const disabled = isLocked ? "disabled" : "";
    return `
      <button type="button" class="${classes.join(" ")}" data-level="${lv.id}" ${disabled} aria-label="Level ${lv.id} ${lv.name}">
        <span class="shLevelCardId">Lv ${lv.id}</span>
        <span class="shLevelCardName">${escapeHtml(lv.name)}</span>
        <span class="shLevelCardMeta">${meta}</span>
      </button>
    `;
  }).join("");
  levelGrid.innerHTML = html;
  for (const btn of levelGrid.querySelectorAll<HTMLButtonElement>("button[data-level]")) {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-level"));
      if (Number.isFinite(id)) startLevel(id);
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showLevelSelect(): void {
  levelFlowState = "select";
  running = false;
  gameOver = false;
  setLevelBarVisible(false);
  renderLevelGrid();
  setOverlay({
    visible: true,
    eyebrow: "Sky Hopper",
    message: "Pick a level",
    hint: `Cleared up to ${unlocked}/${LEVELS.length}.`,
    showLevelSelect: true,
    primaryLabel: `Continue (Lv ${unlocked})`,
    secondaryLabel: null,
  });
}

function handleOverlayPrimary(): void {
  if (levelFlowState === "select") {
    startLevel(unlocked);
    return;
  }
  if (levelFlowState === "complete") {
    if (currentLevel.id < LEVELS.length) {
      startLevel(currentLevel.id + 1);
    } else {
      showLevelSelect();
    }
    return;
  }
  if (levelFlowState === "failed") {
    startLevel(currentLevel.id);
    return;
  }
}

function handleOverlaySecondary(): void {
  showLevelSelect();
}

if (overlayPrimary) overlayPrimary.addEventListener("click", handleOverlayPrimary);
if (overlaySecondary) overlaySecondary.addEventListener("click", handleOverlaySecondary);

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    showLevelSelect();
    return;
  }
  if (e.key === " " || e.key === "ArrowUp" || e.key === "Enter") {
    e.preventDefault();
    flap();
  }
});

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.target instanceof HTMLElement && e.target.closest("button")) return;
  e.preventDefault();
  flap();
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

resetPipes(currentLevel);
syncBird();
applyLevelTheme(currentLevel);
updateHud();
showLevelSelect();
fitToStage();
app.start();

interface SkyHopperTestApi {
  start(level?: number): void;
  passNGates(n?: number): void;
  state(): { level: number; gates: number; goal: number; cleared: boolean; failed: boolean };
}

(window as unknown as { __skyHopperTest?: SkyHopperTestApi }).__skyHopperTest = {
  start(level = 1) {
    unlocked = clampLevel(Math.max(unlocked, level));
    startLevel(level);
  },
  passNGates(n = 1) {
    for (let i = 0; i < n; i++) {
      run = passGate(run);
    }
    updateHud();
    updateLevelBar();
    if (run.cleared) clearLevel();
  },
  state() {
    return {
      level: currentLevel.id,
      gates: run.gatesPassed,
      goal: run.goal,
      cleared: run.cleared,
      failed: run.failed,
    };
  },
};
