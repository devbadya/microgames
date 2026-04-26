import * as pc from "playcanvas";

const SHOTS_PER_MISSION = 5;
const TARGET_Z = -13;
const CAMERA_Z = 8;
const CAMERA_HEIGHT = 3.8;
const AIM_LIMIT_X = 6.1;
const AIM_LIMIT_Y = 2.65;
const AIM_SENSITIVITY = 0.012;
const MISSION_TIME = 80;

const COLORS = {
  bg: new pc.Color(0.035, 0.045, 0.085),
  skyline: new pc.Color(0.075, 0.105, 0.17),
  window: new pc.Color(0.30, 0.50, 0.66),
  personHead: new pc.Color(0.92, 0.72, 0.55),
  neutralized: new pc.Color(0.16, 0.22, 0.30),
  crosshair: new pc.Color(0.80, 0.95, 1.0),
  miss: new pc.Color(1.0, 0.82, 0.28),
  rooftop: new pc.Color(0.09, 0.12, 0.19),
  rifle: new pc.Color(0.06, 0.08, 0.11),
  jacketBlack: new pc.Color(0.035, 0.04, 0.055),
  jacketGrey: new pc.Color(0.18, 0.21, 0.28),
  jacketBlue: new pc.Color(0.10, 0.22, 0.40),
  suspicious: new pc.Color(1.0, 0.36, 0.45),
  civilian: new pc.Color(0.36, 0.80, 1.0),
  package: new pc.Color(0.70, 0.52, 0.22),
  police: new pc.Color(0.25, 0.48, 1.0),
};

type MissionState = "intro" | "playing" | "resolved";
type NpcRole = "realTarget" | "decoy" | "protected";

interface NpcSpec {
  id: string;
  role: NpcRole;
  baseX: number;
  baseY: number;
  jacket: pc.Color;
  speed: number;
  amplitude: number;
  phase: number;
  clues: string[];
}

interface Npc {
  spec: NpcSpec;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  body: pc.Entity;
  head: pc.Entity;
  badge: pc.Entity;
  prop: pc.Entity;
  observeTime: number;
  revealed: number;
}

const missionIntel =
  "Intel: black jacket, meeting a contact, possibly armed. Three people partially match. Confirm behavior before firing.";

const npcSpecs: NpcSpec[] = [
  {
    id: "Subject A",
    role: "decoy",
    baseX: -3.2,
    baseY: -0.55,
    jacket: COLORS.jacketBlack,
    speed: 0.85,
    amplitude: 0.28,
    phase: 0,
    clues: [
      "Subject A keeps checking their phone.",
      "Audio: “I’m late for the interview. Hold the elevator.”",
      "Subject A helps a pedestrian pick up dropped papers.",
    ],
  },
  {
    id: "Subject B",
    role: "realTarget",
    baseX: 0.25,
    baseY: -0.15,
    jacket: COLORS.jacketBlack,
    speed: 0.45,
    amplitude: 0.18,
    phase: 1.8,
    clues: [
      "Subject B avoids the open street and waits near the delivery van.",
      "Audio fragment: “Package changes hands in sixty seconds.”",
      "Subject B reveals a small marked case, then scans the rooftops.",
    ],
  },
  {
    id: "Subject C",
    role: "protected",
    baseX: 3.3,
    baseY: -0.85,
    jacket: COLORS.jacketGrey,
    speed: 0.65,
    amplitude: 0.22,
    phase: 3.2,
    clues: [
      "Subject C matches the jacket description only from a distance.",
      "Audio: “I’m the contact. I’m getting out before this goes wrong.”",
      "Subject C backs away from Subject B, hands visible.",
    ],
  },
];

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const levelEl = document.getElementById("level");
const shotsEl = document.getElementById("shots");
const targetsEl = document.getElementById("targets");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const intelEl = document.getElementById("intelText");
const observeEl = document.getElementById("observeText");
const newsEl = document.getElementById("newsText");

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
  fov: 32,
  clearColor: COLORS.bg,
  nearClip: 0.1,
  farClip: 100,
});
camera.setPosition(0, CAMERA_HEIGHT, CAMERA_Z);
camera.lookAt(0, 0, TARGET_Z);
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

makeBox("skyline", COLORS.skyline, [15.5, 9.0, 0.18], [0, 0, TARGET_Z - 0.65], 0.72);
makeBox("roofline", new pc.Color(0.08, 0.12, 0.20), [15.5, 0.24, 0.3], [0, -3.55, TARGET_Z - 0.25], 0.95);
makeBox("rooftop-ledge", COLORS.rooftop, [11.5, 0.36, 1.35], [0, 1.55, 4.35], 0.96);
makeBox("rooftop-front", new pc.Color(0.05, 0.07, 0.11), [11.5, 0.22, 0.28], [0, 1.34, 3.73], 0.98);
makeBox("rifle-barrel", COLORS.rifle, [0.13, 0.13, 2.55], [1.55, 2.47, 5.35], 0.96);
makeBox("rifle-scope", new pc.Color(0.10, 0.14, 0.19), [0.42, 0.30, 0.48], [1.24, 2.64, 5.95], 0.96);
makeBox("rifle-stock", COLORS.rifle, [0.52, 0.22, 0.72], [1.86, 2.30, 6.28], 0.92);

for (let i = 0; i < 36; i++) {
  const col = i % 9;
  const row = Math.floor(i / 9);
  const x = -6.4 + col * 1.6;
  const y = -2.2 + row * 1.1;
  const lit = (i + row) % 3 !== 0;
  makeBox(`window-${i}`, lit ? COLORS.window : new pc.Color(0.10, 0.15, 0.23), [0.52, 0.32, 0.08], [x, y, TARGET_Z - 0.05], lit ? 0.42 : 0.25);
}

const impactParts = [
  makeBox("impact-h", COLORS.crosshair, [0.62, 0.035, 0.08], [0, 0, TARGET_Z + 0.7], 0),
  makeBox("impact-v", COLORS.crosshair, [0.035, 0.62, 0.08], [0, 0, TARGET_Z + 0.7], 0),
  makeBox("impact-dot", COLORS.crosshair, [0.08, 0.08, 0.08], [0, 0, TARGET_Z + 0.72], 0),
];

let npcs: Npc[] = [];
let shots = SHOTS_PER_MISSION;
let missionClock = MISSION_TIME;
let state: MissionState = "intro";
let flashTimer = 0;
let aimX = 0;
let aimY = 0;
let pointerStart: { x: number; y: number } | null = null;
let pointerLast: { x: number; y: number } | null = null;
let pointerMoved = false;
let outcome = "";

function setText(el: Element | null, text: string): void {
  if (el) el.textContent = text;
}

function updateCameraAim(): void {
  camera.setPosition(aimX * 0.08, CAMERA_HEIGHT + aimY * 0.08, CAMERA_Z);
  camera.lookAt(aimX, aimY, TARGET_Z);
}

function showOverlay(message: string): void {
  if (!overlayEl || !overlayMsg) return;
  overlayMsg.textContent = message;
  overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function updateHud(): void {
  if (levelEl) levelEl.textContent = "01";
  if (shotsEl) shotsEl.textContent = String(shots);
  if (targetsEl) targetsEl.textContent = `${Math.max(0, Math.ceil(missionClock))}s`;
}

function createNpc(spec: NpcSpec): Npc {
  const body = makeBox(`${spec.id}-body`, spec.jacket, [0.46, 0.74, 0.22], [spec.baseX, spec.baseY - 0.18, TARGET_Z + 0.35]);
  const head = makeSphere(`${spec.id}-head`, COLORS.personHead, [0.34, 0.34, 0.34], [spec.baseX, spec.baseY + 0.36, TARGET_Z + 0.42]);
  const badge = makeBox(`${spec.id}-badge`, spec.role === "protected" ? COLORS.civilian : COLORS.suspicious, [0.16, 0.16, 0.08], [spec.baseX, spec.baseY - 0.14, TARGET_Z + 0.62], 0.72);
  const prop = makeBox(`${spec.id}-prop`, spec.role === "realTarget" ? COLORS.package : COLORS.window, [0.26, 0.16, 0.12], [spec.baseX + 0.36, spec.baseY - 0.24, TARGET_Z + 0.55], spec.role === "realTarget" ? 0 : 0.45);
  return {
    spec,
    x: spec.baseX,
    y: spec.baseY,
    radius: 0.46,
    active: true,
    body,
    head,
    badge,
    prop,
    observeTime: 0,
    revealed: 0,
  };
}

function resetMission(): void {
  for (const npc of npcs) {
    npc.body.destroy();
    npc.head.destroy();
    npc.badge.destroy();
    npc.prop.destroy();
  }
  npcs = npcSpecs.map(createNpc);
  shots = SHOTS_PER_MISSION;
  missionClock = MISSION_TIME;
  state = "intro";
  outcome = "";
  aimX = 0;
  aimY = 0;
  updateCameraAim();
  updateHud();
  setText(intelEl, missionIntel);
  setText(observeEl, "Hold the scope over a person to gather behavior and audio clues.");
  setText(newsEl, "City feed: rain moving in, traffic heavy, police channels quiet.");
  showOverlay("Mission 01: vague intel. Observe before you decide.");
}

function startMission(): void {
  state = "playing";
  hideOverlay();
}

function nearestNpc(x: number, y: number): Npc | null {
  let best: Npc | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const npc of npcs) {
    if (!npc.active) continue;
    const dist = Math.hypot(npc.x - x, npc.y - y);
    if (dist < npc.radius && dist < bestDist) {
      best = npc;
      bestDist = dist;
    }
  }
  return best;
}

function showImpact(x: number, y: number, color: pc.Color): void {
  for (const part of impactParts) {
    part.setPosition(x, y, part.getPosition().z);
    part.render!.material = getMaterial(color, 0.95);
  }
  flashTimer = 0.16;
}

function neutralize(npc: Npc): void {
  npc.active = false;
  npc.body.render!.material = getMaterial(COLORS.neutralized, 0.55);
  npc.head.render!.material = getMaterial(COLORS.neutralized, 0.55);
  npc.badge.enabled = false;
  npc.prop.enabled = false;
  npc.body.setLocalScale(0.48, 0.16, 0.22);
  npc.head.setLocalScale(0.18, 0.18, 0.18);
  npc.body.setPosition(npc.x, npc.y - 0.52, TARGET_Z + 0.35);
  npc.head.setPosition(npc.x + 0.32, npc.y - 0.50, TARGET_Z + 0.42);
}

function finish(message: string, news: string): void {
  state = "resolved";
  outcome = message;
  setText(newsEl, news);
  showOverlay(message);
}

function handleShot(): void {
  if (state !== "playing" || shots <= 0) return;
  shots -= 1;
  const hit = nearestNpc(aimX, aimY);

  if (!hit) {
    showImpact(aimX, aimY, COLORS.miss);
    setText(newsEl, "Police scanner: possible shot reported, no confirmed casualty. People begin to scatter.");
    updateHud();
    if (shots === 0) finish("No shots left. The contact leaves the scene.", "Later feed: sirens across the east side. Your handler says the mission failed, but gives no proof.");
    return;
  }

  showImpact(hit.x, hit.y, hit.spec.role === "realTarget" ? COLORS.crosshair : COLORS.miss);
  neutralize(hit);
  updateHud();

  if (hit.spec.role === "realTarget") {
    finish(
      "Shot taken. The package never changes hands.",
      "News crawl: police prevent an unspecified downtown incident. Witness video raises questions about who authorized the rooftop shooter.",
    );
  } else {
    finish(
      "Wrong person. The street erupts into panic.",
      "Breaking: bystander shot from a rooftop. Police flood the district. Your employer goes silent.",
    );
  }
}

function revealObservation(npc: Npc, dt: number): void {
  npc.observeTime += dt;
  const thresholds = [0.8, 2.2, 4.0];
  while (npc.revealed < thresholds.length && npc.observeTime >= thresholds[npc.revealed]!) {
    npc.revealed += 1;
  }

  const visibleClues = npc.spec.clues.slice(0, npc.revealed);
  if (visibleClues.length === 0) {
    setText(observeEl, `${npc.spec.id}: observing... movement pattern unclear.`);
  } else {
    setText(observeEl, `${npc.spec.id}: ${visibleClues.join(" ")}`);
  }
}

function updateNpc(npc: Npc, time: number): void {
  if (!npc.active) return;
  const move = Math.sin(time * npc.spec.speed + npc.spec.phase) * npc.spec.amplitude;
  npc.x = npc.spec.baseX + move;
  const bob = Math.sin(time * 3 + npc.spec.phase) * 0.025;
  npc.body.setPosition(npc.x, npc.y - 0.20 + bob, TARGET_Z + 0.35);
  npc.head.setPosition(npc.x, npc.y + 0.34 + bob, TARGET_Z + 0.42);
  npc.badge.setPosition(npc.x, npc.y - 0.16 + bob, TARGET_Z + 0.62);
  npc.prop.setPosition(npc.x + 0.36, npc.y - 0.24 + bob, TARGET_Z + 0.55);
  npc.prop.enabled = npc.spec.role === "realTarget" && missionClock < 48;
}

function updateMission(dt: number): void {
  if (state !== "playing") return;
  missionClock -= dt;
  if (missionClock <= 0) {
    missionClock = 0;
    updateHud();
    finish(
      "You waited too long. Subject B disappears into the crowd.",
      "Hours later: emergency alerts mention an incident near the transit district. The organization blames your hesitation.",
    );
    return;
  }

  const focused = nearestNpc(aimX, aimY);
  if (focused) revealObservation(focused, dt);
  else setText(observeEl, "No subject centered. Drag the scope and hold on a person to gather clues.");

  if (missionClock < 20 && state === "playing") {
    setText(newsEl, "City feed: the delivery van starts moving. The window to act is closing.");
  }

  updateHud();
}

function continueFromOverlay(): void {
  if (state === "intro") startMission();
  else if (state === "resolved") resetMission();
}

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  if (state !== "playing") {
    continueFromOverlay();
    return;
  }
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerLast = pointerStart;
  pointerMoved = false;
  stage.setPointerCapture(e.pointerId);
});

stage.addEventListener("pointermove", (e: PointerEvent) => {
  if (state !== "playing" || !pointerLast) return;
  e.preventDefault();
  const dx = e.clientX - pointerLast.x;
  const dy = e.clientY - pointerLast.y;
  if (Math.abs(e.clientX - (pointerStart?.x ?? e.clientX)) > 5 || Math.abs(e.clientY - (pointerStart?.y ?? e.clientY)) > 5) {
    pointerMoved = true;
  }
  aimX = clamp(aimX + dx * AIM_SENSITIVITY, -AIM_LIMIT_X, AIM_LIMIT_X);
  aimY = clamp(aimY - dy * AIM_SENSITIVITY, -AIM_LIMIT_Y, AIM_LIMIT_Y);
  pointerLast = { x: e.clientX, y: e.clientY };
  updateCameraAim();
});

stage.addEventListener("pointerup", (e: PointerEvent) => {
  if (state !== "playing") return;
  e.preventDefault();
  pointerLast = null;
  pointerStart = null;
  if (!pointerMoved) handleShot();
});

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    continueFromOverlay();
  } else if (e.key === " ") {
    e.preventDefault();
    if (state === "playing") handleShot();
    else continueFromOverlay();
  } else if (state === "playing" && e.key === "ArrowLeft") {
    e.preventDefault();
    aimX = clamp(aimX - 0.25, -AIM_LIMIT_X, AIM_LIMIT_X);
    updateCameraAim();
  } else if (state === "playing" && e.key === "ArrowRight") {
    e.preventDefault();
    aimX = clamp(aimX + 0.25, -AIM_LIMIT_X, AIM_LIMIT_X);
    updateCameraAim();
  } else if (state === "playing" && e.key === "ArrowUp") {
    e.preventDefault();
    aimY = clamp(aimY + 0.25, -AIM_LIMIT_Y, AIM_LIMIT_Y);
    updateCameraAim();
  } else if (state === "playing" && e.key === "ArrowDown") {
    e.preventDefault();
    aimY = clamp(aimY - 0.25, -AIM_LIMIT_Y, AIM_LIMIT_Y);
    updateCameraAim();
  }
});

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  app.resizeCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

app.on("update", (dt: number) => {
  const time = performance.now() / 1000;
  if (flashTimer > 0) {
    flashTimer = Math.max(0, flashTimer - dt);
    if (flashTimer === 0) {
      for (const part of impactParts) {
        part.render!.material = getMaterial(COLORS.crosshair, 0);
      }
    }
  }
  for (const npc of npcs) updateNpc(npc, time);
  updateMission(dt);
  if (outcome && state === "resolved") setText(observeEl, "Mission note: no clean confirmation. The story changes because of what you chose.");
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

fitToStage();
resetMission();
app.start();
