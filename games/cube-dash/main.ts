import * as pc from "playcanvas";

const WORLD_HEIGHT = 8.5;
const WORLD_WIDTH = 15.5;
const PLAYER_X = -4.8;
const PLAYER_SIZE = 0.72;
const GROUND_Y = -3.05;
const PLAYER_GROUND_Y = GROUND_Y + PLAYER_SIZE / 2;
const GRAVITY = -23.5;
const JUMP_VELOCITY = 9.25;
const BASE_SPEED = 4.35;
const MAX_SPEED_MULT = 1.85;

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
};

type ObstacleKind = "spike" | "block";

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  passed: boolean;
  entity: pc.Entity;
  face?: pc.Entity;
}

interface Spark {
  x: number;
  y: number;
  age: number;
  life: number;
  entity: pc.Entity;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");

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

function updateHud(): void {
  if (scoreEl) scoreEl.textContent = String(score);
  if (bestEl) bestEl.textContent = String(best);
  if (speedEl) speedEl.textContent = `${speedMultiplier.toFixed(1)}×`;
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

const player = makeBox("player", COLORS.cube, [PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE], [PLAYER_X, playerY, 0.16]);
const playerFace = makeBox("playerFace", COLORS.cubeFace, [PLAYER_SIZE * 0.42, PLAYER_SIZE * 0.42, 0.08], [PLAYER_X, playerY, 0.56]);

const sparks: Spark[] = Array.from({ length: 18 }, (_, i) => ({
  x: PLAYER_X,
  y: PLAYER_GROUND_Y,
  age: 1,
  life: 1,
  entity: makeBox(`spark-${i}`, COLORS.spark, [0.08, 0.08, 0.08], [PLAYER_X, PLAYER_GROUND_Y, -0.1], 0),
}));

const obstacles: Obstacle[] = [];

function createObstacle(kind: ObstacleKind, x: number): Obstacle {
  if (kind === "spike") {
    const spike = makeBox("spike", COLORS.spike, [0.58, 0.58, 0.3], [x, GROUND_Y + 0.33, 0.1]);
    spike.setEulerAngles(0, 0, 45);
    return {
      kind,
      x,
      y: GROUND_Y + 0.31,
      w: 0.48,
      h: 0.56,
      passed: false,
      entity: spike,
    };
  }

  const block = makeBox("block", COLORS.block, [0.74, 0.74, 0.34], [x, GROUND_Y + 0.39, 0.08]);
  const face = makeBox("blockFace", COLORS.blockFace, [0.38, 0.38, 0.08], [x, GROUND_Y + 0.39, 0.36], 0.82);
  return {
    kind,
    x,
    y: GROUND_Y + 0.37,
    w: 0.68,
    h: 0.70,
    passed: false,
    entity: block,
    face,
  };
}

function setObstacleKind(obstacle: Obstacle, kind: ObstacleKind): void {
  obstacle.kind = kind;
  obstacle.passed = false;
  if (kind === "spike") {
    obstacle.w = 0.48;
    obstacle.h = 0.56;
    obstacle.y = GROUND_Y + 0.31;
    obstacle.entity.setLocalScale(0.58, 0.58, 0.3);
    obstacle.entity.setEulerAngles(0, 0, 45);
    obstacle.entity.render!.material = getMaterial(COLORS.spike);
    if (obstacle.face) obstacle.face.enabled = false;
  } else {
    obstacle.w = 0.68;
    obstacle.h = 0.70;
    obstacle.y = GROUND_Y + 0.37;
    obstacle.entity.setLocalScale(0.74, 0.74, 0.34);
    obstacle.entity.setEulerAngles(0, 0, 0);
    obstacle.entity.render!.material = getMaterial(COLORS.block);
    if (!obstacle.face) {
      obstacle.face = makeBox("blockFace", COLORS.blockFace, [0.38, 0.38, 0.08], [obstacle.x, obstacle.y, 0.36], 0.82);
    }
    obstacle.face.enabled = true;
  }
}

function syncObstacle(obstacle: Obstacle): void {
  obstacle.entity.setPosition(obstacle.x, obstacle.y, 0.1);
  if (obstacle.face?.enabled) {
    obstacle.face.setPosition(obstacle.x, obstacle.y, 0.36);
  }
}

function nextKind(index: number): ObstacleKind {
  const pattern: ObstacleKind[] = ["spike", "spike", "block", "spike", "block", "spike"];
  return pattern[index % pattern.length]!;
}

function resetObstacles(): void {
  const start = 6.0;
  for (let i = 0; i < 12; i++) {
    const obstacle = obstacles[i] ?? createObstacle(nextKind(i), start + i * 2.45);
    obstacle.x = start + i * 2.45;
    setObstacleKind(obstacle, nextKind(i));
    syncObstacle(obstacle);
    if (!obstacles[i]) obstacles.push(obstacle);
  }
}

function recycleObstacle(obstacle: Obstacle): void {
  const rightMost = Math.max(...obstacles.map((o) => o.x));
  const gap = 2.05 + Math.random() * 1.15;
  obstacle.x = rightMost + gap;
  setObstacleKind(obstacle, Math.random() > 0.34 ? "spike" : "block");
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

function syncPlayer(): void {
  player.setPosition(PLAYER_X, playerY, 0.16);
  player.setEulerAngles(0, 0, playerRotation);
  playerFace.setPosition(PLAYER_X, playerY, 0.56);
  playerFace.setEulerAngles(0, 0, playerRotation);
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
  resetObstacles();
  hideOverlay();
  updateHud();
  syncPlayer();
}

function jump(): void {
  if (!running || gameOver) {
    newGame();
    return;
  }
  if (!grounded) return;
  playerVelocity = JUMP_VELOCITY;
  grounded = false;
}

function endGame(): void {
  running = false;
  gameOver = true;
  best = Math.max(best, score);
  storeBest(best);
  updateHud();
  showOverlay(score === 0 ? "Try again — tap to restart" : `${score} point${score === 1 ? "" : "s"} — tap to restart`);
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}

function hitsObstacle(obstacle: Obstacle): boolean {
  const shrink = obstacle.kind === "spike" ? 0.72 : 0.88;
  return rectsOverlap(
    PLAYER_X,
    playerY,
    PLAYER_SIZE * 0.72,
    PLAYER_SIZE * 0.72,
    obstacle.x,
    obstacle.y,
    obstacle.w * shrink,
    obstacle.h * shrink,
  );
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
    speedMultiplier = Math.min(MAX_SPEED_MULT, 1 + score * 0.035);
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
      syncObstacle(obstacle);

      if (!obstacle.passed && obstacle.x < PLAYER_X - 0.45) {
        obstacle.passed = true;
        score += 1;
        best = Math.max(best, score);
        updateHud();
      }

      if (hitsObstacle(obstacle)) endGame();
      if (obstacle.x < -WORLD_WIDTH / 2 - 2) recycleObstacle(obstacle);
    }
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

window.addEventListener("keydown", (e: KeyboardEvent) => {
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

resetObstacles();
syncPlayer();
updateHud();
showOverlay("Tap to start");
fitToStage();
app.start();
