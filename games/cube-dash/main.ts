import * as pc from "playcanvas";

const WORLD_HEIGHT = 8.5;
const WORLD_WIDTH = 15.5;
const PLAYER_X = -4.8;
const PLAYER_SIZE = 0.72;
const GROUND_Y = -3.05;
const PLAYER_GROUND_Y = GROUND_Y + PLAYER_SIZE / 2;
const GRAVITY = -18.0;
const JUMP_VELOCITY = 9.25;
const BASE_SPEED = 3.55;
const MAX_SPEED_MULT = 1.4;
const LEVEL_LENGTH = 220;

const COLORS = {
  bg: new pc.Color(0.035, 0.045, 0.085),
  grid: new pc.Color(0.12, 0.20, 0.32),
  ground: new pc.Color(0.12, 0.16, 0.25),
  groundTop: new pc.Color(0.46, 0.89, 0.98),
  cube: new pc.Color(0.66, 0.50, 1.0),
  cubeFace: new pc.Color(0.86, 0.78, 1.0),
  spike: new pc.Color(1.0, 0.38, 0.52),
  block: new pc.Color(0.38, 0.84, 1.0),
  blockFace: new pc.Color(0.67, 0.94, 1.0),
  spark: new pc.Color(0.80, 0.96, 1.0),
  pad: new pc.Color(1.0, 0.85, 0.18),
  padGlow: new pc.Color(1.0, 0.95, 0.55),
  orb: new pc.Color(1.0, 0.78, 0.18),
  orbGlow: new pc.Color(1.0, 0.92, 0.5),
};

type ObstacleKind = "spike" | "block" | "pad" | "orb";
type IconShape = "cube" | "diamond" | "orb" | "wide";

interface PatternStep {
  kind: ObstacleKind;
  gap: number;
}

const LEVEL_PATTERN: PatternStep[] = [
  { kind: "spike", gap: 5.5 },
  { kind: "spike", gap: 5.5 },
  { kind: "spike", gap: 5.5 },
  { kind: "spike", gap: 4.2 },
  { kind: "block", gap: 5.5 },
  { kind: "spike", gap: 5.0 },
  { kind: "pad", gap: 5.0 },
  { kind: "orb", gap: 4.6 },
  { kind: "spike", gap: 5.5 },
  { kind: "spike", gap: 3.4 },
  { kind: "spike", gap: 5.5 },
  { kind: "block", gap: 4.6 },
  { kind: "spike", gap: 4.6 },
  { kind: "pad", gap: 5.4 },
  { kind: "block", gap: 5.0 },
  { kind: "orb", gap: 4.6 },
  { kind: "spike", gap: 4.0 },
  { kind: "spike", gap: 3.2 },
  { kind: "spike", gap: 3.2 },
  { kind: "spike", gap: 5.5 },
];

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  passed: boolean;
  used: boolean;
  entity: pc.Entity;
  face?: pc.Entity;
  glow?: pc.Entity;
}

interface Spark {
  x: number;
  y: number;
  age: number;
  life: number;
  entity: pc.Entity;
}

interface IconSettings {
  color: string;
  shape: IconShape;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const progressEl = document.getElementById("progress");
const progressFillEl = document.getElementById("progressFill");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const iconSettingsBtn = document.getElementById("iconSettingsBtn") as HTMLButtonElement | null;
const iconSettingsPanel = document.getElementById("iconSettingsPanel");
const iconColorInput = document.getElementById("iconColor") as HTMLInputElement | null;

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
addLight("fillLight", new pc.Color(0.52, 0.62, 1.0), 0.55, [-25, -40, 0]);
addLight("rimLight", new pc.Color(0.70, 1.0, 0.95), 0.4, [180, 0, 0]);

const materials = new Map<string, pc.StandardMaterial>();

function getMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const key = `${color.r.toFixed(3)}-${color.g.toFixed(3)}-${color.b.toFixed(3)}-${opacity}`;
  let material = materials.get(key);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0.05;
    material.gloss = 0.5;
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

function makeSphere(
  name: string,
  color: pc.Color,
  scale: [number, number, number],
  position: [number, number, number],
  opacity = 1,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "sphere" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  app.root.addChild(entity);
  return entity;
}

function showOverlay(message: string): void {
  if (!overlayEl || !overlayMsg) return;
  overlayMsg.textContent = message;
  overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function getStoredBest(): number {
  const raw = window.localStorage.getItem("microgames.cubeDash.best");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function storeBest(value: number): void {
  window.localStorage.setItem("microgames.cubeDash.best", String(value));
}

const ICON_STORAGE_KEY = "microgames.cubeDash.icon";
const DEFAULT_ICON_SETTINGS: IconSettings = {
  color: "#a78bfa",
  shape: "cube",
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isIconShape(value: unknown): value is IconShape {
  return value === "cube" || value === "diamond" || value === "orb" || value === "wide";
}

function loadIconSettings(): IconSettings {
  try {
    const raw = window.localStorage.getItem(ICON_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<IconSettings>) : {};
    return {
      color: isHexColor(parsed.color) ? parsed.color : DEFAULT_ICON_SETTINGS.color,
      shape: isIconShape(parsed.shape) ? parsed.shape : DEFAULT_ICON_SETTINGS.shape,
    };
  } catch {
    return { ...DEFAULT_ICON_SETTINGS };
  }
}

function saveIconSettings(settings: IconSettings): void {
  window.localStorage.setItem(ICON_STORAGE_KEY, JSON.stringify(settings));
}

function hexToColor(hex: string): pc.Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return new pc.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function liftColor(color: pc.Color, amount: number): pc.Color {
  return new pc.Color(
    color.r + (1 - color.r) * amount,
    color.g + (1 - color.g) * amount,
    color.b + (1 - color.b) * amount,
  );
}

let iconSettings = loadIconSettings();

let playerY = PLAYER_GROUND_Y;
let playerVelocity = 0;
let playerRotation = 0;
let grounded = true;
let running = false;
let gameOver = false;
let score = 0;
let best = getStoredBest();
let speedMultiplier = 1;
let pulse = 0;
let distance = 0;
let patternIndex = 0;

function updateHud(): void {
  if (scoreEl) scoreEl.textContent = String(score);
  if (bestEl) bestEl.textContent = String(best);
  const pct = Math.min(100, Math.floor((distance / LEVEL_LENGTH) * 100));
  if (progressEl) progressEl.textContent = `${pct}%`;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
}

const bgPanel = makeBox("bgPanel", new pc.Color(0.045, 0.07, 0.13), [WORLD_WIDTH + 3, WORLD_HEIGHT + 2, 0.16], [0, 0, -1.9], 0.72);
bgPanel.render!.material = getMaterial(new pc.Color(0.045, 0.07, 0.13), 0.72);

const gridLines: pc.Entity[] = [];
for (let i = 0; i < 16; i++) {
  const x = -WORLD_WIDTH / 2 + i * 1.05;
  gridLines.push(makeBox(`grid-v-${i}`, COLORS.grid, [0.025, WORLD_HEIGHT + 1.5, 0.04], [x, 0.2, -0.9], 0.25));
}
for (let i = 0; i < 8; i++) {
  const y = -3.2 + i * 1.1;
  gridLines.push(makeBox(`grid-h-${i}`, COLORS.grid, [WORLD_WIDTH + 2, 0.025, 0.04], [0, y, -0.9], 0.22));
}

makeBox("ground", COLORS.ground, [WORLD_WIDTH + 4, 0.95, 0.65], [0, GROUND_Y - 0.48, -0.15]);
makeBox("groundTop", COLORS.groundTop, [WORLD_WIDTH + 4, 0.055, 0.12], [0, GROUND_Y + 0.03, 0.06], 0.85);

const playerBox = makeBox("playerBox", COLORS.cube, [PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE], [PLAYER_X, playerY, 0.16]);
const playerOrb = makeSphere("playerOrb", COLORS.cube, [PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE], [PLAYER_X, playerY, 0.16]);
const playerFace = makeBox("playerFace", COLORS.cubeFace, [PLAYER_SIZE * 0.42, PLAYER_SIZE * 0.42, 0.08], [PLAYER_X, playerY, 0.56]);
playerOrb.enabled = false;

const sparks: Spark[] = Array.from({ length: 18 }, (_, i) => ({
  x: PLAYER_X,
  y: PLAYER_GROUND_Y,
  age: 1,
  life: 1,
  entity: makeBox(`spark-${i}`, COLORS.spark, [0.08, 0.08, 0.08], [PLAYER_X, PLAYER_GROUND_Y, -0.1], 0),
}));

const obstacles: Obstacle[] = [];

const ORB_Y = GROUND_Y + 1.95;

function createObstacle(kind: ObstacleKind, x: number): Obstacle {
  const obstacle: Obstacle = {
    kind,
    x,
    y: GROUND_Y,
    w: 0.5,
    h: 0.5,
    passed: false,
    used: false,
    entity: makeBox("obstacle", COLORS.spike, [0.58, 0.58, 0.3], [x, GROUND_Y, 0.1]),
  };
  setObstacleKind(obstacle, kind);
  syncObstacle(obstacle);
  return obstacle;
}

function ensureFace(obstacle: Obstacle): pc.Entity {
  if (!obstacle.face) {
    obstacle.face = makeBox("blockFace", COLORS.blockFace, [0.38, 0.38, 0.08], [obstacle.x, obstacle.y, 0.36], 0.82);
  }
  return obstacle.face;
}

function ensureGlow(obstacle: Obstacle): pc.Entity {
  if (!obstacle.glow) {
    obstacle.glow = makeSphere("obstacleGlow", COLORS.orbGlow, [0.55, 0.55, 0.05], [obstacle.x, ORB_Y, -0.05], 0.45);
  }
  return obstacle.glow;
}

function setObstacleKind(obstacle: Obstacle, kind: ObstacleKind): void {
  obstacle.kind = kind;
  obstacle.passed = false;
  obstacle.used = false;

  if (kind === "spike") {
    obstacle.w = 0.48;
    obstacle.h = 0.56;
    obstacle.y = GROUND_Y + 0.47; // 45° box bottom clears groundTop
    obstacle.entity.setLocalScale(0.58, 0.58, 0.3);
    obstacle.entity.setEulerAngles(0, 0, 45);
    obstacle.entity.render!.material = getMaterial(COLORS.spike);
    if (obstacle.face) obstacle.face.enabled = false;
    if (obstacle.glow) obstacle.glow.enabled = false;
  } else if (kind === "block") {
    obstacle.w = 0.68;
    obstacle.h = 0.70;
    obstacle.y = GROUND_Y + 0.37;
    obstacle.entity.setLocalScale(0.74, 0.74, 0.34);
    obstacle.entity.setEulerAngles(0, 0, 0);
    obstacle.entity.render!.material = getMaterial(COLORS.block);
    const face = ensureFace(obstacle);
    face.enabled = true;
    face.render!.material = getMaterial(COLORS.blockFace, 0.82);
    if (obstacle.glow) obstacle.glow.enabled = false;
  } else if (kind === "pad") {
    obstacle.w = 1.45;
    obstacle.h = 0.22;
    obstacle.y = GROUND_Y + 0.11;
    obstacle.entity.setLocalScale(1.55, 0.22, 0.38);
    obstacle.entity.setEulerAngles(0, 0, 0);
    obstacle.entity.render!.material = getMaterial(COLORS.pad);
    const face = ensureFace(obstacle);
    face.enabled = true;
    face.setLocalScale(1.05, 0.06, 0.06);
    face.render!.material = getMaterial(COLORS.padGlow, 0.95);
    if (obstacle.glow) obstacle.glow.enabled = false;
  } else {
    obstacle.w = 0.85;
    obstacle.h = 0.85;
    obstacle.y = ORB_Y;
    obstacle.entity.setLocalScale(0.6, 0.6, 0.18);
    obstacle.entity.setEulerAngles(0, 0, 45);
    obstacle.entity.render!.material = getMaterial(COLORS.orb);
    if (obstacle.face) obstacle.face.enabled = false;
    const glow = ensureGlow(obstacle);
    glow.enabled = true;
    glow.render!.material = getMaterial(COLORS.orbGlow, 0.45);
  }
}

function syncObstacle(obstacle: Obstacle): void {
  obstacle.entity.setPosition(obstacle.x, obstacle.y, obstacle.kind === "orb" ? 0.05 : 0.1);
  if (obstacle.face?.enabled) {
    if (obstacle.kind === "pad") {
      obstacle.face.setPosition(obstacle.x, obstacle.y + 0.13, 0.18);
    } else {
      obstacle.face.setPosition(obstacle.x, obstacle.y, 0.36);
    }
  }
  if (obstacle.glow?.enabled) {
    obstacle.glow.setPosition(obstacle.x, obstacle.y, -0.05);
  }
}

function resetObstacles(): void {
  patternIndex = 0;
  let cursor = 6.5;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const step = LEVEL_PATTERN[patternIndex % LEVEL_PATTERN.length]!;
    patternIndex += 1;
    cursor += step.gap;
    const obstacle = obstacles[i] ?? createObstacle(step.kind, cursor);
    obstacle.x = cursor;
    setObstacleKind(obstacle, step.kind);
    syncObstacle(obstacle);
    if (!obstacles[i]) obstacles.push(obstacle);
  }
}

function recycleObstacle(obstacle: Obstacle): void {
  const rightMost = Math.max(...obstacles.map((o) => o.x));
  const step = LEVEL_PATTERN[patternIndex % LEVEL_PATTERN.length]!;
  patternIndex += 1;
  obstacle.x = rightMost + step.gap;
  setObstacleKind(obstacle, step.kind);
  syncObstacle(obstacle);
}

function emitSpark(): void {
  const spark = sparks.find((s) => s.age >= s.life);
  if (!spark) return;
  spark.x = PLAYER_X - 0.44;
  spark.y = PLAYER_GROUND_Y - 0.35 + Math.random() * 0.16;
  spark.age = 0;
  spark.life = 0.25 + Math.random() * 0.22;
  spark.entity.setLocalScale(0.08, 0.08, 0.08);
  spark.entity.render!.material = getMaterial(COLORS.spark, 0.75);
}

function shapeScale(shape: IconShape): [number, number, number] {
  if (shape === "wide") return [PLAYER_SIZE * 1.18, PLAYER_SIZE * 0.64, PLAYER_SIZE * 0.78];
  if (shape === "diamond") return [PLAYER_SIZE * 0.84, PLAYER_SIZE * 0.84, PLAYER_SIZE * 0.78];
  if (shape === "orb") return [PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.9];
  return [PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE];
}

function applyIconSettings(): void {
  const base = hexToColor(iconSettings.color);
  const face = liftColor(base, 0.58);
  playerBox.render!.material = getMaterial(base);
  playerOrb.render!.material = getMaterial(base);
  playerFace.render!.material = getMaterial(face, 0.92);
  if (iconColorInput) iconColorInput.value = iconSettings.color;

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-shape]")) {
    button.classList.toggle("is-active", button.dataset["shape"] === iconSettings.shape);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-color]")) {
    button.classList.toggle("is-active", button.dataset["color"]?.toLowerCase() === iconSettings.color.toLowerCase());
  }
  syncPlayer();
}

function setIconSettings(next: Partial<IconSettings>): void {
  iconSettings = {
    color: isHexColor(next.color) ? next.color : iconSettings.color,
    shape: isIconShape(next.shape) ? next.shape : iconSettings.shape,
  };
  saveIconSettings(iconSettings);
  applyIconSettings();
}

function syncPlayer(): void {
  const shape = iconSettings.shape;
  const scale = shapeScale(shape);
  const rotationOffset = shape === "diamond" ? 45 : 0;
  const rotation = playerRotation + rotationOffset;
  const activePlayer = shape === "orb" ? playerOrb : playerBox;

  playerBox.enabled = shape !== "orb";
  playerOrb.enabled = shape === "orb";

  activePlayer.setLocalScale(...scale);
  activePlayer.setPosition(PLAYER_X, playerY, 0.16);
  activePlayer.setEulerAngles(0, 0, rotation);

  playerFace.enabled = shape !== "orb";
  if (playerFace.enabled) {
    const faceScale: [number, number, number] =
      shape === "wide" ? [PLAYER_SIZE * 0.50, PLAYER_SIZE * 0.24, 0.08] : [PLAYER_SIZE * 0.42, PLAYER_SIZE * 0.42, 0.08];
    playerFace.setLocalScale(...faceScale);
    playerFace.setPosition(PLAYER_X, playerY, 0.56);
    playerFace.setEulerAngles(0, 0, rotation);
  }
}

function newGame(): void {
  playerY = PLAYER_GROUND_Y;
  playerVelocity = 0;
  playerRotation = 0;
  grounded = true;
  running = true;
  gameOver = false;
  score = 0;
  speedMultiplier = 1;
  distance = 0;
  resetObstacles();
  hideOverlay();
  updateHud();
  syncPlayer();
}

function rectsOverlapXY(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}

function tryOrbJump(): boolean {
  for (const obstacle of obstacles) {
    if (obstacle.kind !== "orb" || obstacle.used) continue;
    if (
      rectsOverlapXY(
        PLAYER_X,
        playerY,
        PLAYER_SIZE * 1.1,
        PLAYER_SIZE * 1.1,
        obstacle.x,
        obstacle.y,
        obstacle.w,
        obstacle.h,
      )
    ) {
      obstacle.used = true;
      playerVelocity = JUMP_VELOCITY * 0.95;
      grounded = false;
      if (obstacle.glow) obstacle.glow.render!.material = getMaterial(COLORS.orbGlow, 0.18);
      obstacle.entity.render!.material = getMaterial(COLORS.orb, 0.55);
      return true;
    }
  }
  return false;
}

function jump(): void {
  if (!running || gameOver) {
    newGame();
    return;
  }
  if (grounded) {
    playerVelocity = JUMP_VELOCITY;
    grounded = false;
    return;
  }
  tryOrbJump();
}

function endGame(): void {
  running = false;
  gameOver = true;
  best = Math.max(best, score);
  storeBest(best);
  updateHud();
  showOverlay(score === 0 ? "Try again — tap to restart" : `${score} point${score === 1 ? "" : "s"} — tap to restart`);
}

function hitsObstacle(obstacle: Obstacle): boolean {
  if (obstacle.kind === "pad" || obstacle.kind === "orb") return false;
  const shrink = obstacle.kind === "spike" ? 0.6 : 0.86;
  return rectsOverlapXY(
    PLAYER_X,
    playerY,
    PLAYER_SIZE * 0.7,
    PLAYER_SIZE * 0.7,
    obstacle.x,
    obstacle.y,
    obstacle.w * shrink,
    obstacle.h * shrink,
  );
}

function tryActivatePad(obstacle: Obstacle): void {
  if (obstacle.kind !== "pad" || obstacle.used) return;
  if (
    rectsOverlapXY(
      PLAYER_X,
      playerY,
      PLAYER_SIZE * 1.1,
      PLAYER_SIZE * 1.2,
      obstacle.x,
      obstacle.y + 0.25,
      obstacle.w,
      0.8,
    )
  ) {
    obstacle.used = true;
    playerVelocity = JUMP_VELOCITY * 1.4;
    grounded = false;
    obstacle.entity.render!.material = getMaterial(COLORS.pad, 0.45);
    if (obstacle.face) obstacle.face.render!.material = getMaterial(COLORS.padGlow, 0.4);
  }
}

function updateBackground(dt: number, speed: number): void {
  for (const line of gridLines) {
    const pos = line.getPosition();
    pos.x -= speed * 0.22 * dt;
    if (pos.x < -WORLD_WIDTH / 2 - 1) pos.x += WORLD_WIDTH + 2;
    line.setPosition(pos);
  }
}

function updateSparks(dt: number): void {
  if (running && grounded && !gameOver && Math.random() < 0.8) emitSpark();

  for (const spark of sparks) {
    if (spark.age >= spark.life) {
      spark.entity.render!.material = getMaterial(COLORS.spark, 0);
      continue;
    }
    spark.age += dt;
    spark.x -= BASE_SPEED * speedMultiplier * 1.2 * dt;
    spark.y += dt * 0.6;
    const t = 1 - spark.age / spark.life;
    spark.entity.setPosition(spark.x, spark.y, 0);
    spark.entity.setLocalScale(0.08 * t, 0.08 * t, 0.08 * t);
    spark.entity.render!.material = getMaterial(COLORS.spark, Math.max(0, t * 0.7));
  }
}

app.on("update", (dt: number) => {
  pulse += dt;
  const speed = BASE_SPEED * speedMultiplier;
  updateBackground(dt, speed);
  updateSparks(dt);

  if (running && !gameOver) {
    speedMultiplier = Math.min(MAX_SPEED_MULT, 1 + score * 0.012);
    distance += speed * dt;
    playerVelocity += GRAVITY * dt;
    playerY += playerVelocity * dt;

    if (playerY <= PLAYER_GROUND_Y) {
      playerY = PLAYER_GROUND_Y;
      playerVelocity = 0;
      grounded = true;
      playerRotation = Math.round(playerRotation / 90) * 90;
    } else {
      grounded = false;
      playerRotation -= speed * 125 * dt;
    }

    for (const obstacle of obstacles) {
      obstacle.x -= speed * dt;

      if (obstacle.kind === "orb" && !obstacle.used) {
        const bob = Math.sin(pulse * 4 + obstacle.x * 0.3) * 0.08;
        obstacle.y = ORB_Y + bob;
        obstacle.entity.setEulerAngles(0, 0, 45 + pulse * 90);
      }

      syncObstacle(obstacle);

      if (!obstacle.passed && obstacle.x < PLAYER_X - 0.45) {
        obstacle.passed = true;
        if (obstacle.kind === "spike" || obstacle.kind === "block") {
          score += 1;
          best = Math.max(best, score);
        }
      }

      tryActivatePad(obstacle);

      if (hitsObstacle(obstacle)) endGame();
      if (obstacle.x < -WORLD_WIDTH / 2 - 2) recycleObstacle(obstacle);
    }

    updateHud();
  } else {
    playerRotation += Math.sin(pulse * 2.5) * dt * 4;
  }

  syncPlayer();
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

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

function toggleIconSettings(force?: boolean): void {
  if (!iconSettingsBtn || !iconSettingsPanel) return;
  const open = force ?? iconSettingsPanel.hidden;
  iconSettingsPanel.hidden = !open;
  iconSettingsBtn.setAttribute("aria-expanded", String(open));
}

function eventStartedInSettings(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("#iconSettingsPanel, #iconSettingsBtn"));
}

iconSettingsBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleIconSettings();
});

iconColorInput?.addEventListener("input", () => {
  setIconSettings({ color: iconColorInput.value });
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-color]")) {
  button.addEventListener("click", () => {
    const color = button.dataset["color"];
    if (isHexColor(color)) setIconSettings({ color });
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-shape]")) {
  button.addEventListener("click", () => {
    const shape = button.dataset["shape"];
    if (isIconShape(shape)) setIconSettings({ shape });
  });
}

document.addEventListener("pointerdown", (e: PointerEvent) => {
  if (!eventStartedInSettings(e.target)) toggleIconSettings(false);
});

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (eventStartedInSettings(e.target)) return;
  if (e.key === " " || e.key === "ArrowUp" || e.key === "Enter") {
    e.preventDefault();
    jump();
  }
});

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  jump();
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

applyIconSettings();
resetObstacles();
syncPlayer();
updateHud();
showOverlay("Tap to start");
fitToStage();
app.start();
