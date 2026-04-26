import * as pc from "playcanvas";

const WORLD_HEIGHT = 10;
const WORLD_WIDTH = 16;
const BIRD_X = -4.7;
const BIRD_RADIUS = 0.38;
const GROUND_Y = -4.2;
const CEILING_Y = 4.4;
const PIPE_WIDTH = 1.15;
const PIPE_GAP = 2.85;
const PIPE_SPACING = 5.2;
const PIPE_SPEED = 3.05;
const GRAVITY = -20.5;
const FLAP_VELOCITY = 7.1;

const COLORS = {
  bg: new pc.Color(0.035, 0.055, 0.095),
  bird: new pc.Color(0.98, 0.78, 0.30),
  wing: new pc.Color(1.0, 0.56, 0.42),
  beak: new pc.Color(1.0, 0.86, 0.36),
  pipe: new pc.Color(0.32, 0.86, 0.76),
  pipeCap: new pc.Color(0.45, 0.96, 0.86),
  ground: new pc.Color(0.12, 0.18, 0.28),
  cloud: new pc.Color(0.68, 0.76, 0.92),
  star: new pc.Color(0.78, 0.92, 1.0),
};

interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
  top: pc.Entity;
  topCap: pc.Entity;
  bottom: pc.Entity;
  bottomCap: pc.Entity;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  entity: pc.Entity;
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
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

function randomGapY(): number {
  return -1.95 + Math.random() * 3.9;
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
  const raw = window.localStorage.getItem("microgames.skyHopper.best");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function storeBest(value: number): void {
  window.localStorage.setItem("microgames.skyHopper.best", String(value));
}

function updateHud(): void {
  if (scoreEl) scoreEl.textContent = String(score);
  if (bestEl) bestEl.textContent = String(best);
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

function createPipe(x: number): Pipe {
  const pipe: Pipe = {
    x,
    gapY: randomGapY(),
    scored: false,
    top: makeBox("topPipe", COLORS.pipe, [PIPE_WIDTH, 1, 0.55], [x, 0, 0]),
    topCap: makeBox("topPipeCap", COLORS.pipeCap, [PIPE_WIDTH + 0.25, 0.28, 0.65], [x, 0, 0.02]),
    bottom: makeBox("bottomPipe", COLORS.pipe, [PIPE_WIDTH, 1, 0.55], [x, 0, 0]),
    bottomCap: makeBox("bottomPipeCap", COLORS.pipeCap, [PIPE_WIDTH + 0.25, 0.28, 0.65], [x, 0, 0.02]),
  };
  updatePipeEntities(pipe);
  return pipe;
}

function updatePipeEntities(pipe: Pipe): void {
  const topBottom = pipe.gapY + PIPE_GAP / 2;
  const bottomTop = pipe.gapY - PIPE_GAP / 2;
  const topHeight = Math.max(0.2, CEILING_Y - topBottom);
  const bottomHeight = Math.max(0.2, bottomTop - GROUND_Y);

  pipe.top.setLocalScale(PIPE_WIDTH, topHeight, 0.55);
  pipe.top.setPosition(pipe.x, topBottom + topHeight / 2, 0);
  pipe.topCap.setPosition(pipe.x, topBottom + 0.1, 0.02);

  pipe.bottom.setLocalScale(PIPE_WIDTH, bottomHeight, 0.55);
  pipe.bottom.setPosition(pipe.x, GROUND_Y + bottomHeight / 2, 0);
  pipe.bottomCap.setPosition(pipe.x, bottomTop - 0.1, 0.02);
}

function resetPipes(): void {
  for (let i = 0; i < 4; i++) {
    const pipe = pipes[i] ?? createPipe(6.5 + i * PIPE_SPACING);
    pipe.x = 6.5 + i * PIPE_SPACING;
    pipe.gapY = randomGapY();
    pipe.scored = false;
    updatePipeEntities(pipe);
    if (!pipes[i]) pipes.push(pipe);
  }
}

let birdY = 0;
let birdVelocity = 0;
let score = 0;
let best = getStoredBest();
let running = false;
let gameOver = false;
let wingPhase = 0;

function syncBird(): void {
  const tilt = Math.max(-28, Math.min(28, birdVelocity * 4.2));
  bird.setPosition(BIRD_X, birdY, 0.1);
  bird.setEulerAngles(0, 0, tilt);
  wing.setPosition(BIRD_X - 0.12, birdY - 0.02 + Math.sin(wingPhase) * 0.06, 0.36);
  wing.setEulerAngles(0, 0, tilt - 12);
  beak.setPosition(BIRD_X + 0.39, birdY + 0.03, 0.16);
  beak.setEulerAngles(0, 0, tilt);
}

function newGame(): void {
  birdY = 0;
  birdVelocity = 0;
  score = 0;
  running = true;
  gameOver = false;
  resetPipes();
  hideOverlay();
  updateHud();
  syncBird();
}

function flap(): void {
  if (!running || gameOver) {
    newGame();
    return;
  }
  birdVelocity = FLAP_VELOCITY;
}

function endGame(): void {
  running = false;
  gameOver = true;
  best = Math.max(best, score);
  storeBest(best);
  updateHud();
  showOverlay(score === 0 ? "Try again — tap to restart" : `${score} point${score === 1 ? "" : "s"} — tap to restart`);
}

function pipeCollides(pipe: Pipe): boolean {
  const birdLeft = BIRD_X - BIRD_RADIUS * 0.85;
  const birdRight = BIRD_X + BIRD_RADIUS * 0.85;
  const pipeLeft = pipe.x - PIPE_WIDTH / 2;
  const pipeRight = pipe.x + PIPE_WIDTH / 2;
  const overlapsX = birdRight > pipeLeft && birdLeft < pipeRight;
  if (!overlapsX) return false;

  const gapTop = pipe.gapY + PIPE_GAP / 2;
  const gapBottom = pipe.gapY - PIPE_GAP / 2;
  return birdY + BIRD_RADIUS * 0.85 > gapTop || birdY - BIRD_RADIUS * 0.85 < gapBottom;
}

function recyclePipe(pipe: Pipe): void {
  const rightMost = Math.max(...pipes.map((p) => p.x));
  pipe.x = rightMost + PIPE_SPACING;
  pipe.gapY = randomGapY();
  pipe.scored = false;
  updatePipeEntities(pipe);
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
  updateScene(dt);

  if (running && !gameOver) {
    birdVelocity += GRAVITY * dt;
    birdY += birdVelocity * dt;

    if (birdY - BIRD_RADIUS <= GROUND_Y || birdY + BIRD_RADIUS >= CEILING_Y) {
      endGame();
    }

    for (const pipe of pipes) {
      pipe.x -= PIPE_SPEED * dt;
      updatePipeEntities(pipe);

      if (!pipe.scored && pipe.x < BIRD_X - PIPE_WIDTH / 2) {
        pipe.scored = true;
        score += 1;
        best = Math.max(best, score);
        updateHud();
      }

      if (pipeCollides(pipe)) {
        endGame();
      }

      if (pipe.x < -WORLD_WIDTH / 2 - 2) recyclePipe(pipe);
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

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === " " || e.key === "ArrowUp" || e.key === "Enter") {
    e.preventDefault();
    flap();
  }
});

stage.addEventListener("pointerdown", (e: PointerEvent) => {
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

resetPipes();
syncBird();
updateHud();
showOverlay("Tap to start");
fitToStage();
app.start();
