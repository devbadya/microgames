import * as pc from "playcanvas";

const SHOTS_PER_LEVEL = 5;
const LEVEL_COUNT = 10;
const ORTHO_HALF_HEIGHT = 4.8;

const COLORS = {
  bg: new pc.Color(0.035, 0.045, 0.085),
  skyline: new pc.Color(0.075, 0.105, 0.17),
  window: new pc.Color(0.30, 0.50, 0.66),
  civilian: new pc.Color(0.35, 0.82, 1.0),
  civilianHead: new pc.Color(0.92, 0.72, 0.55),
  hostile: new pc.Color(1.0, 0.32, 0.42),
  hostileHead: new pc.Color(0.92, 0.72, 0.55),
  neutralized: new pc.Color(0.16, 0.22, 0.30),
  crosshair: new pc.Color(0.80, 0.95, 1.0),
  miss: new pc.Color(1.0, 0.82, 0.28),
  safe: new pc.Color(0.35, 0.90, 0.65),
};

type TargetKind = "civilian" | "hostile";
type LevelState = "intro" | "playing" | "clear" | "failed" | "complete";

interface TargetSpec {
  kind: TargetKind;
  x: number;
  y: number;
}

interface LevelSpec {
  targets: TargetSpec[];
}

interface Target {
  kind: TargetKind;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  body: pc.Entity;
  head: pc.Entity;
  badge: pc.Entity;
}

const levels: LevelSpec[] = [
  { targets: [{ kind: "hostile", x: 0.4, y: -0.4 }, { kind: "civilian", x: -2.6, y: -1.0 }, { kind: "civilian", x: 3.2, y: 0.6 }] },
  { targets: [{ kind: "hostile", x: -2.7, y: 0.8 }, { kind: "hostile", x: 2.4, y: -1.0 }, { kind: "civilian", x: 0.0, y: 1.1 }] },
  { targets: [{ kind: "hostile", x: -3.4, y: -1.2 }, { kind: "hostile", x: 0.7, y: 0.9 }, { kind: "civilian", x: 3.1, y: -0.1 }, { kind: "civilian", x: -0.8, y: -1.7 }] },
  { targets: [{ kind: "hostile", x: -4.5, y: 1.3 }, { kind: "hostile", x: 0.1, y: -0.7 }, { kind: "hostile", x: 4.0, y: 0.8 }, { kind: "civilian", x: -2.0, y: -1.6 }] },
  { targets: [{ kind: "hostile", x: -3.5, y: 0.0 }, { kind: "hostile", x: 2.8, y: 1.2 }, { kind: "hostile", x: 3.9, y: -1.4 }, { kind: "civilian", x: -0.2, y: 1.7 }, { kind: "civilian", x: 1.2, y: -1.8 }] },
  { targets: [{ kind: "hostile", x: -5.0, y: -1.0 }, { kind: "hostile", x: -1.5, y: 1.2 }, { kind: "hostile", x: 2.1, y: -0.2 }, { kind: "civilian", x: 4.5, y: 1.1 }, { kind: "civilian", x: 0.2, y: -1.8 }] },
  { targets: [{ kind: "hostile", x: -4.2, y: 1.4 }, { kind: "hostile", x: -0.6, y: -1.2 }, { kind: "hostile", x: 2.7, y: 1.2 }, { kind: "hostile", x: 4.8, y: -0.9 }, { kind: "civilian", x: 1.0, y: 0.0 }] },
  { targets: [{ kind: "hostile", x: -5.1, y: 0.2 }, { kind: "hostile", x: -2.2, y: -1.5 }, { kind: "hostile", x: 1.6, y: 1.3 }, { kind: "hostile", x: 4.2, y: -1.2 }, { kind: "civilian", x: 0.2, y: -0.4 }, { kind: "civilian", x: 3.3, y: 1.6 }] },
  { targets: [{ kind: "hostile", x: -4.7, y: -1.4 }, { kind: "hostile", x: -1.7, y: 1.3 }, { kind: "hostile", x: 1.7, y: -0.5 }, { kind: "hostile", x: 4.7, y: 1.1 }, { kind: "civilian", x: -0.1, y: -1.8 }, { kind: "civilian", x: 2.8, y: -1.8 }] },
  { targets: [{ kind: "hostile", x: -5.2, y: 1.3 }, { kind: "hostile", x: -2.3, y: -1.6 }, { kind: "hostile", x: 1.2, y: 1.0 }, { kind: "hostile", x: 4.8, y: -0.7 }, { kind: "civilian", x: -0.6, y: -0.5 }, { kind: "civilian", x: 3.0, y: 1.7 }] },
];

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const levelEl = document.getElementById("level");
const shotsEl = document.getElementById("shots");
const targetsEl = document.getElementById("targets");
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
  orthoHeight: ORTHO_HALF_HEIGHT,
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
addLight("fillLight", new pc.Color(0.55, 0.70, 1), 0.55, [-25, -45, 0]);

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

function makeBox(name: string, color: pc.Color, scale: [number, number, number], position: [number, number, number], opacity = 1): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "box" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  app.root.addChild(entity);
  return entity;
}

function makeSphere(name: string, color: pc.Color, scale: [number, number, number], position: [number, number, number], opacity = 1): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "sphere" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  app.root.addChild(entity);
  return entity;
}

makeBox("skyline", COLORS.skyline, [15.5, 9.0, 0.18], [0, 0, -1.7], 0.72);
makeBox("roofline", new pc.Color(0.08, 0.12, 0.20), [15.5, 0.24, 0.3], [0, -3.55, -0.45], 0.95);

for (let i = 0; i < 36; i++) {
  const col = i % 9;
  const row = Math.floor(i / 9);
  const x = -6.4 + col * 1.6;
  const y = -2.2 + row * 1.1;
  const lit = (i + row) % 3 !== 0;
  makeBox(`window-${i}`, lit ? COLORS.window : new pc.Color(0.10, 0.15, 0.23), [0.52, 0.32, 0.08], [x, y, -0.65], lit ? 0.42 : 0.25);
}

const crosshairParts = [
  makeBox("crosshair-h", COLORS.crosshair, [0.62, 0.035, 0.08], [0, 0, 0.6], 0),
  makeBox("crosshair-v", COLORS.crosshair, [0.035, 0.62, 0.08], [0, 0, 0.6], 0),
  makeBox("crosshair-dot", COLORS.crosshair, [0.08, 0.08, 0.08], [0, 0, 0.62], 0),
];

let targets: Target[] = [];
let levelIndex = 0;
let shots = SHOTS_PER_LEVEL;
let state: LevelState = "intro";
let flashTimer = 0;

function showOverlay(message: string): void {
  if (!overlayEl || !overlayMsg) return;
  overlayMsg.textContent = message;
  overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function updateHud(): void {
  const remaining = targets.filter((target) => target.kind === "hostile" && target.active).length;
  if (levelEl) levelEl.textContent = `${Math.min(levelIndex + 1, LEVEL_COUNT)}/${LEVEL_COUNT}`;
  if (shotsEl) shotsEl.textContent = String(shots);
  if (targetsEl) targetsEl.textContent = String(remaining);
}

function destroyTargets(): void {
  for (const target of targets) {
    target.body.destroy();
    target.head.destroy();
    target.badge.destroy();
  }
  targets = [];
}

function createTarget(spec: TargetSpec): Target {
  const hostile = spec.kind === "hostile";
  const bodyColor = hostile ? COLORS.hostile : COLORS.civilian;
  const headColor = hostile ? COLORS.hostileHead : COLORS.civilianHead;
  const badgeColor = hostile ? new pc.Color(0.95, 0.95, 1.0) : COLORS.safe;
  const body = makeBox(`${spec.kind}-body`, bodyColor, [0.46, 0.74, 0.22], [spec.x, spec.y - 0.18, 0.1]);
  const head = makeSphere(`${spec.kind}-head`, headColor, [0.34, 0.34, 0.34], [spec.x, spec.y + 0.36, 0.16]);
  const badge = makeBox(`${spec.kind}-badge`, badgeColor, hostile ? [0.26, 0.07, 0.08] : [0.18, 0.18, 0.08], [spec.x, spec.y - 0.14, 0.32], 0.9);
  if (hostile) badge.setEulerAngles(0, 0, 45);
  return {
    kind: spec.kind,
    x: spec.x,
    y: spec.y + 0.02,
    radius: 0.46,
    active: true,
    body,
    head,
    badge,
  };
}

function loadLevel(index: number): void {
  destroyTargets();
  levelIndex = index;
  shots = SHOTS_PER_LEVEL;
  state = "intro";
  for (const spec of levels[levelIndex]!.targets) {
    targets.push(createTarget(spec));
  }
  updateHud();
  showOverlay(`Level ${levelIndex + 1}: protect civilians, neutralize red targets.`);
}

function showImpact(x: number, y: number, color: pc.Color): void {
  for (const part of crosshairParts) {
    part.setPosition(x, y, part.getPosition().z);
    part.render!.material = getMaterial(color, 0.95);
  }
  flashTimer = 0.16;
}

function levelComplete(): void {
  if (levelIndex >= LEVEL_COUNT - 1) {
    state = "complete";
    showOverlay("Mission complete. All 10 levels cleared.");
    return;
  }
  state = "clear";
  showOverlay(`Level ${levelIndex + 1} clear. Tap for level ${levelIndex + 2}.`);
}

function fail(message: string): void {
  state = "failed";
  showOverlay(`${message} Tap to retry level ${levelIndex + 1}.`);
}

function nearestTarget(x: number, y: number): Target | null {
  let best: Target | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (!target.active) continue;
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < target.radius && dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return best;
}

function neutralize(target: Target): void {
  target.active = false;
  target.body.render!.material = getMaterial(COLORS.neutralized, 0.5);
  target.head.render!.material = getMaterial(COLORS.neutralized, 0.5);
  target.badge.enabled = false;
  target.body.setLocalScale(0.48, 0.16, 0.22);
  target.head.setLocalScale(0.18, 0.18, 0.18);
  target.body.setPosition(target.x, target.y - 0.52, 0.1);
  target.head.setPosition(target.x + 0.32, target.y - 0.50, 0.16);
}

function handleShot(x: number, y: number): void {
  if (state !== "playing") return;
  if (shots <= 0) return;
  shots -= 1;

  const hit = nearestTarget(x, y);
  if (!hit) {
    showImpact(x, y, COLORS.miss);
  } else if (hit.kind === "civilian") {
    showImpact(hit.x, hit.y, COLORS.miss);
    updateHud();
    fail("Civilian hit.");
    return;
  } else {
    showImpact(hit.x, hit.y, COLORS.crosshair);
    neutralize(hit);
  }

  const remaining = targets.filter((target) => target.kind === "hostile" && target.active).length;
  updateHud();
  if (remaining === 0) levelComplete();
  else if (shots === 0) fail("Out of shots.");
}

function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
  const aspect = rect.width / rect.height;
  const halfH = camera.camera!.orthoHeight;
  const halfW = halfH * aspect;
  return { x: nx * halfW, y: ny * halfH };
}

function continueFromOverlay(): void {
  if (state === "intro") {
    state = "playing";
    hideOverlay();
  } else if (state === "clear") {
    loadLevel(levelIndex + 1);
  } else if (state === "failed") {
    loadLevel(levelIndex);
  } else if (state === "complete") {
    loadLevel(0);
  }
}

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  if (state !== "playing") {
    continueFromOverlay();
    return;
  }
  const p = screenToWorld(e.clientX, e.clientY);
  handleShot(p.x, p.y);
});

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    continueFromOverlay();
  }
});

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  app.resizeCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

app.on("update", (dt: number) => {
  if (flashTimer > 0) {
    flashTimer = Math.max(0, flashTimer - dt);
    if (flashTimer === 0) {
      for (const part of crosshairParts) {
        part.render!.material = getMaterial(COLORS.crosshair, 0);
      }
    }
  }
  for (const target of targets) {
    if (!target.active) continue;
    const bob = Math.sin(performance.now() / 450 + target.x) * 0.025;
    target.body.setPosition(target.x, target.y - 0.20 + bob, 0.1);
    target.head.setPosition(target.x, target.y + 0.34 + bob, 0.16);
    target.badge.setPosition(target.x, target.y - 0.16 + bob, 0.32);
  }
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

fitToStage();
loadLevel(0);
app.start();
