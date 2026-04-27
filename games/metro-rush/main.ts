import * as pc from "playcanvas";

const LANES = [-2.1, 0, 2.1] as const;
const PLAYER_Z = 3.1;
const GROUND_Y = 0;
const PLAYER_HEIGHT = 1.18;
const PLAYER_WIDTH = 0.72;
const BASE_SPEED = 12.0;
const MAX_SPEED_MULT = 2.35;
const LANE_SMOOTH = 16;
const CAM_HEIGHT = 3.45;
const CAM_DIST = 5.1;
const LOOK_AHEAD_Z = -22;
const GRAVITY = -28;
const JUMP_VELOCITY = 10.5;
const SLIDE_TIME = 0.58;

const COLORS = {
  bg: new pc.Color(0.12, 0.2, 0.32),
  track: new pc.Color(0.14, 0.18, 0.22),
  trackStripe: new pc.Color(0.22, 0.3, 0.38),
  rail: new pc.Color(0.95, 0.78, 0.2),
  railDark: new pc.Color(0.55, 0.45, 0.1),
  lane: new pc.Color(0.55, 0.55, 0.5),
  wall: new pc.Color(0.2, 0.55, 0.62),
  wallTop: new pc.Color(0.3, 0.75, 0.7),
  runner: new pc.Color(0.2, 0.55, 0.95),
  runnerFace: new pc.Color(0.96, 0.72, 0.54),
  runnerPants: new pc.Color(0.12, 0.22, 0.55),
  runnerShoes: new pc.Color(1.0, 0.5, 0.25),
  coin: new pc.Color(1.0, 0.88, 0.2),
  barrier: new pc.Color(0.9, 0.25, 0.32),
  low: new pc.Color(0.55, 0.4, 0.95),
  high: new pc.Color(0.15, 0.8, 0.45),
  train: new pc.Color(0.22, 0.35, 0.5),
  trainFront: new pc.Color(0.35, 0.45, 0.55),
  trainGlass: new pc.Color(0.5, 0.85, 1.0),
  trainStripe: new pc.Color(0.95, 0.75, 0.2),
  glow: new pc.Color(0.4, 0.95, 0.9),
};

type ItemKind = "coin" | "barrier" | "low" | "high" | "train";
type Action = "left" | "right" | "jump" | "slide";

interface Item {
  kind: ItemKind;
  lane: number;
  z: number;
  active: boolean;
  passed: boolean;
  entity: pc.Entity;
  aux: pc.Entity[];
}

interface Character {
  root: pc.Entity;
  body: pc.Entity;
  head: pc.Entity;
  cap: pc.Entity;
  armL: pc.Entity;
  armR: pc.Entity;
  legL: pc.Entity;
  legR: pc.Entity;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const bestEl = document.getElementById("best");
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
  projection: pc.PROJECTION_PERSPECTIVE,
  fov: 64,
  clearColor: COLORS.bg,
  nearClip: 0.1,
  farClip: 100,
});
camera.setPosition(0, CAM_HEIGHT, PLAYER_Z + CAM_DIST);
camera.lookAt(0, 0.9, LOOK_AHEAD_Z);
app.root.addChild(camera);

function addLight(name: string, color: pc.Color, intensity: number, euler: [number, number, number]): void {
  const light = new pc.Entity(name);
  light.addComponent("light", { type: "directional", color, intensity });
  light.setEulerAngles(...euler);
  app.root.addChild(light);
}

addLight("sun", new pc.Color(1, 0.98, 0.92), 0.85, [50, 42, 0]);
addLight("keyLight", new pc.Color(0.9, 0.95, 1.0), 0.7, [35, 20, 0]);
addLight("fillLight", new pc.Color(0.45, 0.75, 0.9), 0.45, [-35, -25, 0]);
addLight("rimLight", new pc.Color(0.4, 1.0, 0.85), 0.28, [160, 0, 0]);

const materials = new Map<string, pc.StandardMaterial>();

function getMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const key = `${color.r.toFixed(3)}-${color.g.toFixed(3)}-${color.b.toFixed(3)}-${opacity}`;
  let material = materials.get(key);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0.06;
    material.gloss = 0.52;
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
  const raw = window.localStorage.getItem("microgames.metroRush.best");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function storeBest(value: number): void {
  window.localStorage.setItem("microgames.metroRush.best", String(value));
}

let laneIndex = 1;
let targetLaneIndex = 1;
let playerX = LANES[laneIndex];
let playerY = GROUND_Y + PLAYER_HEIGHT / 2;
let playerVelocity = 0;
let slideTimer = 0;
let running = false;
let gameOver = false;
let score = 0;
let coins = 0;
let best = getStoredBest();
let distance = 0;
let speedMultiplier = 1;
let spawnCursor = -18;
let runPhase = 0;

function updateHud(): void {
  if (scoreEl) scoreEl.textContent = String(score);
  if (coinsEl) coinsEl.textContent = String(coins);
  if (bestEl) bestEl.textContent = String(best);
}

const worldScroll: pc.Entity[] = [];
for (let i = 0; i < 8; i++) {
  const z = -42 + i * 7;
  const deck = makeBox(`track-${i}`, COLORS.track, [7.3, 0.2, 6.7], [0, -0.1, z]);
  worldScroll.push(
    deck,
    makeBox(`track-stripe-${i}`, COLORS.trackStripe, [6.0, 0.04, 6.4], [0, 0.02, z], 0.7),
    makeBox(`rail-l-${i}`, COLORS.rail, [0.1, 0.14, 6.7], [LANES[0] - 1.12, 0.08, z], 0.98),
    makeBox(`rail-l-in-${i}`, COLORS.railDark, [0.05, 0.08, 6.5], [LANES[0] - 1.0, 0.08, z], 0.88),
    makeBox(`rail-r-${i}`, COLORS.rail, [0.1, 0.14, 6.7], [LANES[2] + 1.12, 0.08, z], 0.98),
    makeBox(`rail-r-in-${i}`, COLORS.railDark, [0.05, 0.08, 6.5], [LANES[2] + 1.0, 0.08, z], 0.88),
  );
}

const laneMarkers: pc.Entity[] = [];
for (let i = 0; i < 16; i++) {
  const z = -45 + i * 3.5;
  laneMarkers.push(
    makeBox(`lane-a-${i}`, COLORS.lane, [0.08, 0.04, 1.6], [-1.05, 0.06, z], 0.75),
    makeBox(`lane-b-${i}`, COLORS.lane, [0.08, 0.04, 1.6], [1.05, 0.06, z], 0.75),
  );
}

const wallL: pc.Entity[] = [];
const wallR: pc.Entity[] = [];
const wallLTop: pc.Entity[] = [];
const wallRTop: pc.Entity[] = [];
for (let i = 0; i < 8; i++) {
  const z = -42 + i * 7;
  wallL.push(makeBox(`wallL-${i}`, COLORS.wall, [0.5, 2.2, 6.5], [-3.4, 1.0, z]));
  wallR.push(makeBox(`wallR-${i}`, COLORS.wall, [0.5, 2.2, 6.5], [3.4, 1.0, z]));
  wallLTop.push(makeBox(`wallL-top-${i}`, COLORS.wallTop, [0.55, 0.16, 6.5], [-3.4, 2.2, z], 0.9));
  wallRTop.push(makeBox(`wallR-top-${i}`, COLORS.wallTop, [0.55, 0.16, 6.5], [3.4, 2.2, z], 0.9));
  for (const e of [wallL[i]!, wallR[i]!, wallLTop[i]!, wallRTop[i]!]) worldScroll.push(e);
}

function makeCharacter(): Character {
  const root = new pc.Entity("runnerRoot");
  app.root.addChild(root);

  const body = makeBox("runnerBody", COLORS.runner, [0.62, 0.82, 0.38], [0, 0.88, 0]);
  const head = makeSphere("runnerHead", COLORS.runnerFace, [0.42, 0.42, 0.42], [0, 1.52, 0.02]);
  const cap = makeBox("runnerCap", COLORS.runnerShoes, [0.50, 0.14, 0.42], [0, 1.78, 0.04]);
  const armL = makeBox("runnerArmL", COLORS.runnerFace, [0.16, 0.58, 0.18], [-0.45, 0.86, 0]);
  const armR = makeBox("runnerArmR", COLORS.runnerFace, [0.16, 0.58, 0.18], [0.45, 0.86, 0]);
  const legL = makeBox("runnerLegL", COLORS.runnerPants, [0.18, 0.62, 0.18], [-0.2, 0.28, 0]);
  const legR = makeBox("runnerLegR", COLORS.runnerPants, [0.18, 0.62, 0.18], [0.2, 0.28, 0]);

  for (const part of [body, head, cap, armL, armR, legL, legR]) {
    part.reparent(root);
  }

  root.setEulerAngles(0, 180, 0);
  return { root, body, head, cap, armL, armR, legL, legR };
}

const character = makeCharacter();

const items: Item[] = [];

function createItem(kind: ItemKind, lane: number, z: number): Item {
  const entity = makeBox("item", COLORS.coin, [0.5, 0.5, 0.16], [LANES[lane], 1.05, z]);
  const item: Item = { kind, lane, z, active: true, passed: false, entity, aux: [] };
  applyItemKind(item, kind);
  return item;
}

function chooseKind(): ItemKind {
  const r = Math.random();
  if (r < 0.34) return "coin";
  if (r < 0.58) return "train";
  if (r < 0.72) return "low";
  if (r < 0.86) return "high";
  return "barrier";
}

function applyItemKind(item: Item, kind: ItemKind): void {
  item.kind = kind;
  item.active = true;
  item.passed = false;
  item.entity.enabled = true;
  for (const aux of item.aux) aux.destroy();
  item.aux = [];

  if (kind === "coin") {
    item.entity.setLocalScale(0.44, 0.44, 0.12);
    item.entity.setEulerAngles(0, 0, 0);
    item.entity.render!.material = getMaterial(COLORS.coin);
  } else if (kind === "low") {
    item.entity.setLocalScale(0.85, 0.52, 0.62);
    item.entity.setEulerAngles(0, 0, 0);
    item.entity.render!.material = getMaterial(COLORS.low);
  } else if (kind === "high") {
    item.entity.setLocalScale(1.0, 0.38, 0.62);
    item.entity.setEulerAngles(0, 0, 0);
    item.entity.render!.material = getMaterial(COLORS.high);
  } else if (kind === "train") {
    item.entity.setLocalScale(1.46, 1.85, 3.7);
    item.entity.setEulerAngles(0, 0, 0);
    item.entity.render!.material = getMaterial(COLORS.train);
    item.aux.push(makeBox("trainGlass", COLORS.trainGlass, [0.96, 0.42, 0.08], [LANES[item.lane], 1.45, item.z + 1.9], 0.86));
    item.aux.push(makeBox("trainLightL", COLORS.glow, [0.18, 0.18, 0.08], [LANES[item.lane] - 0.42, 0.54, item.z + 1.92], 0.95));
    item.aux.push(makeBox("trainLightR", COLORS.glow, [0.18, 0.18, 0.08], [LANES[item.lane] + 0.42, 0.54, item.z + 1.92], 0.95));
    item.aux.push(
      makeBox("trainNose", COLORS.trainFront, [1.35, 0.5, 0.35], [LANES[item.lane], 0.62, item.z + 1.78], 0.95),
    );
    item.aux.push(
      makeBox("trainStripe", COLORS.trainStripe, [1.4, 0.16, 0.1], [LANES[item.lane], 0.38, item.z + 0.2], 1),
    );
  } else {
    item.entity.setLocalScale(1.05, 1.35, 0.7);
    item.entity.setEulerAngles(0, 0, 0);
    item.entity.render!.material = getMaterial(COLORS.barrier);
    item.aux.push(makeBox("barrierStripe", COLORS.glow, [0.82, 0.08, 0.74], [LANES[item.lane], 0.95, item.z + 0.01], 0.86));
  }
}

function syncItem(item: Item): void {
  const x = LANES[item.lane];
  let y = 0.7;
  if (item.kind === "coin") y = 1.25;
  if (item.kind === "high") y = 1.55;
  if (item.kind === "barrier") y = 0.72;
  if (item.kind === "train") y = 0.88;
  item.entity.setPosition(x, y, item.z);
  if (item.kind === "coin") item.entity.rotateLocal(0, 2.6, 0);
  if (item.kind === "train") {
    item.aux[0]?.setPosition(x, 1.45, item.z + 1.9);
    item.aux[1]?.setPosition(x - 0.42, 0.54, item.z + 1.92);
    item.aux[2]?.setPosition(x + 0.42, 0.54, item.z + 1.92);
    item.aux[3]?.setPosition(x, 0.62, item.z + 1.78);
    item.aux[4]?.setPosition(x, 0.38, item.z + 0.2);
  } else {
    item.aux[0]?.setPosition(x, 0.95, item.z + 0.01);
  }
}

function recycleItem(item: Item): void {
  const gap = 2.9 + Math.random() * 2.4;
  spawnCursor -= gap;
  item.z = spawnCursor;
  item.lane = Math.floor(Math.random() * LANES.length);
  applyItemKind(item, chooseKind());
  syncItem(item);
}

function resetItems(): void {
  spawnCursor = -16;
  for (let i = 0; i < 18; i++) {
    const existing = items[i];
    if (existing) recycleItem(existing);
    else {
      spawnCursor -= 2.8 + Math.random() * 2.2;
      items.push(createItem(chooseKind(), Math.floor(Math.random() * LANES.length), spawnCursor));
    }
  }
}

function isSliding(): boolean {
  return slideTimer > 0;
}

function newGame(): void {
  laneIndex = 1;
  targetLaneIndex = 1;
  playerX = LANES[laneIndex];
  playerY = GROUND_Y + PLAYER_HEIGHT / 2;
  playerVelocity = 0;
  slideTimer = 0;
  score = 0;
  coins = 0;
  distance = 0;
  speedMultiplier = 1;
  running = true;
  gameOver = false;
  resetItems();
  hideOverlay();
  updateHud();
}

function jump(): void {
  if (playerY > GROUND_Y + PLAYER_HEIGHT / 2 + 0.05) return;
  playerVelocity = JUMP_VELOCITY;
  slideTimer = 0;
}

function slide(): void {
  if (playerY > GROUND_Y + PLAYER_HEIGHT / 2 + 0.1) return;
  slideTimer = SLIDE_TIME;
}

function performAction(action: Action): void {
  if (!running || gameOver) {
    newGame();
    return;
  }
  if (action === "left") targetLaneIndex = Math.max(0, targetLaneIndex - 1);
  if (action === "right") targetLaneIndex = Math.min(LANES.length - 1, targetLaneIndex + 1);
  if (action === "jump") jump();
  if (action === "slide") slide();
}

function endGame(): void {
  running = false;
  gameOver = true;
  best = Math.max(best, score);
  storeBest(best);
  updateHud();
  showOverlay(score === 0 ? "Try again — swipe to restart" : `${score} points — swipe to restart`);
}

function collides(item: Item): boolean {
  if (!item.active) return false;
  const depth = item.kind === "train" ? 2.1 : 0.72;
  if (Math.abs(item.z - PLAYER_Z) > depth) return false;
  if (Math.abs(LANES[item.lane] - playerX) > 0.78) return false;
  if (item.kind === "coin") return true;
  if (item.kind === "train") return true;
  if (item.kind === "low") return playerY < 1.45;
  if (item.kind === "high") return !isSliding();
  return true;
}

function updatePlayer(dt: number): void {
  laneIndex = targetLaneIndex;
  playerX += (LANES[targetLaneIndex] - playerX) * Math.min(1, dt * LANE_SMOOTH);
  playerVelocity += GRAVITY * dt;
  playerY += playerVelocity * dt;
  const groundY = GROUND_Y + PLAYER_HEIGHT / 2;
  if (playerY <= groundY) {
    playerY = groundY;
    playerVelocity = 0;
  }
  slideTimer = Math.max(0, slideTimer - dt);

  const slideScaleY = isSliding() ? PLAYER_HEIGHT * 0.52 : PLAYER_HEIGHT;
  const slideCenterY = GROUND_Y + slideScaleY / 2;
  const y = isSliding() ? slideCenterY : playerY;
  const dLane = LANES[targetLaneIndex] - playerX;
  const strafeBank = dLane * -18;
  runPhase += dt * 16;
  const swing = Math.sin(runPhase) * 22;

  character.root.setPosition(playerX, isSliding() ? y - 0.18 : y - PLAYER_HEIGHT / 2, PLAYER_Z);
  character.root.setEulerAngles(0, 180, strafeBank);
  character.body.setLocalScale(PLAYER_WIDTH * 0.7, slideScaleY * 0.62, 0.38);
  character.body.setLocalPosition(0, isSliding() ? 0.55 : 0.88, 0);
  character.head.enabled = !isSliding();
  character.cap.enabled = !isSliding();
  character.armL.setEulerAngles(0, 0, swing);
  character.armR.setEulerAngles(0, 0, -swing);
  character.legL.setEulerAngles(0, 0, -swing);
  character.legR.setEulerAngles(0, 0, swing);
}

const SCROLL_WRAP = 56;
function updateTrack(dt: number, speed: number): void {
  for (const e of worldScroll) {
    const p = e.getPosition();
    p.z += speed * dt;
    if (p.z > 7) p.z -= SCROLL_WRAP;
    e.setPosition(p);
  }
  for (const marker of laneMarkers) {
    const p = marker.getPosition();
    p.z += speed * dt;
    if (p.z > 7) p.z -= SCROLL_WRAP;
    marker.setPosition(p);
  }
}

function updateCamera(_dt: number, speed: number): void {
  if (!camera.camera) return;
  const sway = running && !gameOver ? Math.sin(runPhase * 0.35) * 0.04 : 0;
  const camX = playerX * 0.32 + sway;
  const lookX = playerX * 0.42;
  const bounce = running && !gameOver ? speed * 0.0012 : 0;
  camera.setPosition(camX, CAM_HEIGHT, PLAYER_Z + CAM_DIST);
  camera.lookAt(lookX, 0.9 + bounce, LOOK_AHEAD_Z);
}

app.on("update", (dt: number) => {
  const speed = BASE_SPEED * speedMultiplier;
  updateTrack(dt, speed);

  if (running && !gameOver) {
    distance += speed * dt;
    speedMultiplier = Math.min(MAX_SPEED_MULT, 1 + distance / 900);
    score = Math.max(score, Math.floor(distance / 7) + coins * 5);

    updatePlayer(dt);
    for (const item of items) {
      item.z += speed * dt;
      syncItem(item);
      if (collides(item)) {
        if (item.kind === "coin") {
          item.active = false;
          item.entity.enabled = false;
          coins += 1;
          score += 5;
          updateHud();
        } else {
          endGame();
        }
      }
      if (item.z > PLAYER_Z + 7) recycleItem(item);
    }
    best = Math.max(best, score);
    updateHud();
  } else {
    character.root.rotateLocal(0, Math.sin(performance.now() / 700) * dt * 4, 0);
  }
  updateCamera(dt, speed);
});

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  app.resizeCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    performAction("left");
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    performAction("right");
  } else if (e.key === "ArrowUp" || e.key === " " || e.key === "Enter") {
    e.preventDefault();
    performAction("jump");
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    performAction("slide");
  }
});

let pointerStart: { x: number; y: number } | null = null;

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  pointerStart = { x: e.clientX, y: e.clientY };
});

stage.addEventListener("pointerup", (e: PointerEvent) => {
  e.preventDefault();
  if (!pointerStart) {
    performAction("jump");
    return;
  }
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) performAction(dx < 0 ? "left" : "right");
  else if (dy < -28) performAction("jump");
  else if (dy > 28) performAction("slide");
  else performAction("jump");
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

resetItems();
updatePlayer(0);
updateHud();
showOverlay("Swipe to start");
fitToStage();
app.start();
