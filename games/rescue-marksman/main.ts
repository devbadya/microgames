import * as pc from "playcanvas";

const SHOTS_PER_MISSION = 5;
const MISSION_TIME = 75;
const LOOK_SENSITIVITY = 0.0032;
const YAW_LIMIT = 0.48;
const PITCH_MIN = 0.08;
const PITCH_MAX = 0.72;
const CAMERA_HEIGHT = 8.2;
const CAMERA_Z = 15.6;
const MODEL_BASE = "../../models/rescue-marksman/";

const COLORS = {
  bg: new pc.Color(0.035, 0.045, 0.085),
  street: new pc.Color(0.075, 0.085, 0.11),
  sidewalk: new pc.Color(0.18, 0.20, 0.24),
  roof: new pc.Color(0.08, 0.10, 0.14),
  buildingA: new pc.Color(0.12, 0.17, 0.25),
  buildingB: new pc.Color(0.18, 0.14, 0.22),
  buildingC: new pc.Color(0.10, 0.20, 0.21),
  window: new pc.Color(0.43, 0.75, 0.92),
  hostile: new pc.Color(0.96, 0.24, 0.34),
  civilian: new pc.Color(0.28, 0.74, 1.0),
  neutralized: new pc.Color(0.18, 0.21, 0.28),
  skin: new pc.Color(0.92, 0.70, 0.50),
  weapon: new pc.Color(0.05, 0.06, 0.08),
  muzzle: new pc.Color(1.0, 0.72, 0.26),
  hit: new pc.Color(1.0, 0.86, 0.32),
  foliage: new pc.Color(0.18, 0.42, 0.28),
};

type MissionState = "intro" | "playing" | "won" | "lost";
type ActorRole = "hostile" | "civilian";

interface Actor {
  role: ActorRole;
  id: string;
  root: pc.Entity;
  body: pc.Entity;
  head: pc.Entity;
  prop: pc.Entity;
  baseX: number;
  z: number;
  y: number;
  radius: number;
  speed: number;
  amplitude: number;
  phase: number;
  alive: boolean;
  revealed: boolean;
}

interface ModelPlacement {
  file: string;
  name: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
}

type ContainerAsset = pc.Asset & { resource: pc.ContainerResource };

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const shotsEl = document.getElementById("shots");
const hostilesEl = document.getElementById("hostiles");
const civiliansEl = document.getElementById("civilians");
const timerEl = document.getElementById("timer");
const intelText = document.getElementById("intelText");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const fireBtn = document.getElementById("fireBtn");
const restartBtn = document.getElementById("restartBtn");

const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  keyboard: new pc.Keyboard(window),
  graphicsDeviceOptions: { antialias: true, alpha: false },
});

app.setCanvasFillMode(pc.FILLMODE_NONE);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const camera = new pc.Entity("sniper-camera");
camera.addComponent("camera", {
  projection: pc.PROJECTION_PERSPECTIVE,
  fov: 36,
  clearColor: COLORS.bg,
  nearClip: 0.05,
  farClip: 90,
});
camera.setPosition(0, CAMERA_HEIGHT, CAMERA_Z);
app.root.addChild(camera);

function addLight(name: string, color: pc.Color, intensity: number, euler: [number, number, number]): void {
  const light = new pc.Entity(name);
  light.addComponent("light", { type: "directional", color, intensity });
  light.setEulerAngles(...euler);
  app.root.addChild(light);
}

addLight("moon-key", new pc.Color(0.78, 0.86, 1.0), 1.0, [42, 28, 0]);
addLight("city-fill", new pc.Color(0.28, 0.54, 1.0), 0.45, [-24, -42, 0]);

const materials = new Map<string, pc.StandardMaterial>();

function getMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const key = `${color.r.toFixed(3)}-${color.g.toFixed(3)}-${color.b.toFixed(3)}-${opacity}`;
  let material = materials.get(key);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0.04;
    material.gloss = 0.42;
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
  parent: pc.Entity = app.root,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "box" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  parent.addChild(entity);
  return entity;
}

function makeSphere(
  name: string,
  color: pc.Color,
  scale: [number, number, number],
  position: [number, number, number],
  opacity = 1,
  parent: pc.Entity = app.root,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "sphere" });
  entity.setLocalScale(...scale);
  entity.setPosition(...position);
  entity.render!.material = getMaterial(color, opacity);
  parent.addChild(entity);
  return entity;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function setText(el: Element | null, text: string): void {
  if (el) el.textContent = text;
}

function showOverlay(message: string): void {
  setText(overlayMsg, message);
  if (overlayEl) overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

let state: MissionState = "intro";
let shots = SHOTS_PER_MISSION;
let missionTime = MISSION_TIME;
let yaw = 0;
let pitch = 0.33;
let shotFlashTimer = 0;
let pointerStart: { x: number; y: number } | null = null;
let pointerLast: { x: number; y: number } | null = null;
const actors: Actor[] = [];

const weaponRoot = new pc.Entity("weapon-root");
camera.addChild(weaponRoot);
weaponRoot.setLocalPosition(0.62, -0.52, -1.0);
makeBox("rifle-body", COLORS.weapon, [0.34, 0.18, 0.85], [0, 0, 0], 1, weaponRoot);
makeBox("rifle-barrel", COLORS.weapon, [0.09, 0.09, 1.15], [0.08, 0.02, -0.72], 1, weaponRoot);
makeBox("rifle-scope", new pc.Color(0.10, 0.13, 0.17), [0.23, 0.17, 0.30], [-0.02, 0.17, -0.12], 1, weaponRoot);
const muzzleFlash = makeBox("muzzle-flash", COLORS.muzzle, [0.18, 0.18, 0.08], [0.08, 0.02, -1.34], 0, weaponRoot);

function updateCameraAim(): void {
  yaw = clamp(yaw, -YAW_LIMIT, YAW_LIMIT);
  pitch = clamp(pitch, PITCH_MIN, PITCH_MAX);
  camera.setPosition(0, CAMERA_HEIGHT, CAMERA_Z);
  camera.setEulerAngles((pitch * 180) / Math.PI, (yaw * 180) / Math.PI, 0);
}

function cameraForward(): pc.Vec3 {
  const cp = Math.cos(pitch);
  return new pc.Vec3(Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
}

function updateHud(): void {
  const hostiles = actors.filter((actor) => actor.role === "hostile" && actor.alive).length;
  const civilians = actors.filter((actor) => actor.role === "civilian" && actor.alive).length;
  setText(shotsEl, String(shots));
  setText(hostilesEl, String(hostiles));
  setText(civiliansEl, String(civilians));
  setText(timerEl, `${Math.ceil(Math.max(0, missionTime))}s`);
}

function loadModel(placement: ModelPlacement): void {
  app.assets.loadFromUrl(`${MODEL_BASE}${placement.file}`, "container", (err: string | null, asset?: pc.Asset) => {
    if (err || !asset?.resource) {
      console.warn(`Could not load model ${placement.file}`, err);
      return;
    }
    const entity = (asset as ContainerAsset).resource.instantiateRenderEntity({ castShadows: false });
    entity.name = placement.name;
    entity.setPosition(...placement.position);
    entity.setLocalScale(...placement.scale);
    if (placement.rotation) entity.setEulerAngles(...placement.rotation);
    app.root.addChild(entity);
  });
}

function createCityBiome(): void {
  makeBox("skyline-backdrop", new pc.Color(0.05, 0.07, 0.12), [46, 16, 0.28], [0, 7.5, -33], 0.72);
  makeBox("street-main", COLORS.street, [22, 0.08, 30], [0, -0.05, -9.5]);
  makeBox("street-cross", COLORS.street, [34, 0.09, 6], [0, -0.03, -9.5]);
  makeBox("sidewalk-left", COLORS.sidewalk, [4.4, 0.14, 29], [-13.1, 0.02, -9.5]);
  makeBox("sidewalk-right", COLORS.sidewalk, [4.4, 0.14, 29], [13.1, 0.02, -9.5]);
  makeBox("crosswalk-a", new pc.Color(0.68, 0.72, 0.75), [0.18, 0.04, 3.8], [-3.5, 0.04, -6.7], 0.88);
  makeBox("crosswalk-b", new pc.Color(0.68, 0.72, 0.75), [0.18, 0.04, 3.8], [-2.3, 0.04, -6.7], 0.88);
  makeBox("crosswalk-c", new pc.Color(0.68, 0.72, 0.75), [0.18, 0.04, 3.8], [-1.1, 0.04, -6.7], 0.88);
  makeBox("crosswalk-d", new pc.Color(0.68, 0.72, 0.75), [0.18, 0.04, 3.8], [0.1, 0.04, -6.7], 0.88);
  makeBox("rooftop-ledge", COLORS.roof, [11.5, 0.35, 2.5], [0, 5.92, 11.7]);
  makeBox("rooftop-front", new pc.Color(0.04, 0.05, 0.08), [11.7, 1.05, 0.34], [0, 5.38, 10.5]);

  const buildings: Array<[string, pc.Color, [number, number, number], [number, number, number]]> = [
    ["tower-left-a", COLORS.buildingA, [4.6, 8.5, 5.5], [-15.5, 4.25, -19]],
    ["tower-left-b", COLORS.buildingB, [5.2, 6.8, 5.0], [-15.2, 3.4, -7.3]],
    ["tower-right-a", COLORS.buildingC, [5.0, 9.8, 5.8], [15.4, 4.9, -17.6]],
    ["tower-right-b", COLORS.buildingB, [4.6, 7.2, 5.2], [15.1, 3.6, -4.7]],
    ["back-tower-a", COLORS.buildingA, [5.0, 11.0, 4.8], [-7.8, 5.5, -28]],
    ["back-tower-b", COLORS.buildingC, [4.6, 9.0, 4.6], [6.9, 4.5, -27.5]],
  ];

  for (const [name, color, scale, position] of buildings) {
    makeBox(name, color, scale, position, 0.96);
    const [sx, sy, sz] = scale;
    const [px, , pz] = position;
    const rows = Math.max(2, Math.floor(sy / 1.4));
    for (let row = 0; row < rows; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        makeBox(`${name}-window-${row}-${col}`, COLORS.window, [0.45, 0.28, 0.04], [px + col * sx * 0.24, 1.15 + row * 1.15, pz + sz * 0.51], 0.58);
      }
    }
  }

  for (const [x, z] of [
    [-8.2, -12.8],
    [-5.8, -4.6],
    [6.2, -14.4],
    [8.1, -2.8],
  ]) {
    makeBox("street-lamp-post", new pc.Color(0.10, 0.12, 0.15), [0.12, 2.6, 0.12], [x, 1.3, z]);
    makeSphere("street-lamp-glow", COLORS.window, [0.36, 0.36, 0.36], [x, 2.72, z], 0.62);
  }

  makeBox("delivery-van-fallback", new pc.Color(0.20, 0.36, 0.25), [2.8, 1.1, 1.3], [4.4, 0.55, -5.9]);
  makeBox("delivery-van-window", COLORS.window, [0.75, 0.36, 0.05], [3.55, 1.06, -5.22], 0.72);
  makeBox("crate-cover-a", new pc.Color(0.45, 0.28, 0.15), [1.1, 0.9, 1.1], [-2.6, 0.45, -8.4]);
  makeBox("crate-cover-b", new pc.Color(0.45, 0.28, 0.15), [1.5, 0.75, 1.1], [7.4, 0.38, -10.2]);
  makeBox("tree-trunk", new pc.Color(0.28, 0.17, 0.10), [0.28, 1.3, 0.28], [-10.3, 0.65, -2.6]);
  makeSphere("tree-top", COLORS.foliage, [1.15, 1.15, 1.15], [-10.3, 1.7, -2.6]);

  const placements: ModelPlacement[] = [
    { file: "building-small-a.glb", name: "kenney-building-a", position: [-11.2, 0, -16.5], scale: [1.35, 1.35, 1.35], rotation: [0, 90, 0] },
    { file: "building-small-b.glb", name: "kenney-building-b", position: [10.8, 0, -12.0], scale: [1.35, 1.35, 1.35], rotation: [0, -90, 0] },
    { file: "building-small-c.glb", name: "kenney-building-c", position: [-9.8, 0, -3.8], scale: [1.25, 1.25, 1.25], rotation: [0, 90, 0] },
    { file: "road-intersection.glb", name: "kenney-road-intersection", position: [0, 0.07, -9.2], scale: [2.2, 2.2, 2.2] },
    { file: "road-straight-lightposts.glb", name: "kenney-road-lightposts", position: [0, 0.08, -17.5], scale: [2.1, 2.1, 2.1] },
    { file: "vehicle-truck-green.glb", name: "kenney-truck", position: [4.5, 0.2, -5.8], scale: [1.2, 1.2, 1.2], rotation: [0, -18, 0] },
  ];
  for (const placement of placements) loadModel(placement);
}

function createActor(
  id: string,
  role: ActorRole,
  baseX: number,
  z: number,
  speed: number,
  amplitude: number,
  phase: number,
): Actor {
  const root = new pc.Entity(`${id}-root`);
  root.setPosition(baseX, 0, z);
  app.root.addChild(root);
  const bodyColor = role === "hostile" ? COLORS.hostile : COLORS.civilian;
  const body = makeBox(`${id}-body`, bodyColor, [0.56, 1.05, 0.38], [0, 0.76, 0], 1, root);
  const head = makeSphere(`${id}-head`, COLORS.skin, [0.34, 0.34, 0.34], [0, 1.48, 0], 1, root);
  const prop =
    role === "hostile"
      ? makeBox(`${id}-weapon`, COLORS.weapon, [0.72, 0.11, 0.13], [0.42, 0.93, -0.15], 1, root)
      : makeBox(`${id}-rescue-marker`, new pc.Color(0.15, 0.82, 0.42), [0.24, 0.24, 0.08], [0, 0.94, -0.21], 1, root);

  return {
    role,
    id,
    root,
    body,
    head,
    prop,
    baseX,
    z,
    y: 1.0,
    radius: role === "hostile" ? 0.52 : 0.48,
    speed,
    amplitude,
    phase,
    alive: true,
    revealed: false,
  };
}

function resetActors(): void {
  for (const actor of actors) actor.root.destroy();
  actors.length = 0;
  actors.push(createActor("hostile-a", "hostile", -4.8, -11.8, 0.8, 0.46, 0));
  actors.push(createActor("hostile-b", "hostile", 2.2, -14.7, 0.55, 0.36, 1.3));
  actors.push(createActor("hostile-c", "hostile", 7.1, -8.8, 0.7, 0.42, 2.4));
  actors.push(createActor("hostile-d", "hostile", -0.8, -5.7, 0.62, 0.34, 3.5));
  actors.push(createActor("civilian-a", "civilian", -6.8, -6.8, 0.45, 0.28, 0.8));
  actors.push(createActor("civilian-b", "civilian", 5.5, -12.0, 0.5, 0.3, 2.9));
}

function actorCenter(actor: Actor): pc.Vec3 {
  return new pc.Vec3(actor.root.getPosition().x, actor.y, actor.root.getPosition().z);
}

function nearestActorOnAim(): Actor | null {
  const origin = camera.getPosition().clone();
  const direction = cameraForward();
  let best: Actor | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const actor of actors) {
    if (!actor.alive) continue;
    const center = actorCenter(actor);
    const toActor = center.clone().sub(origin);
    const along = toActor.dot(direction);
    if (along <= 0) continue;
    const closest = origin.clone().add(direction.clone().mulScalar(along));
    const missDistance = closest.distance(center);
    if (missDistance < actor.radius && along < bestDist) {
      best = actor;
      bestDist = along;
    }
  }
  return best;
}

function setMissionText(text: string): void {
  setText(intelText, text);
}

function endMission(next: MissionState, message: string): void {
  state = next;
  updateHud();
  showOverlay(message);
}

function startMission(): void {
  state = "playing";
  shots = SHOTS_PER_MISSION;
  missionTime = MISSION_TIME;
  yaw = 0;
  pitch = 0.33;
  shotFlashTimer = 0;
  resetActors();
  updateCameraAim();
  updateHud();
  setMissionText("Red jackets are armed. Blue civilians must survive. Wait for a clear shot.");
  hideOverlay();
}

function neutralize(actor: Actor): void {
  actor.alive = false;
  actor.body.render!.material = getMaterial(COLORS.neutralized, 0.55);
  actor.head.render!.material = getMaterial(COLORS.neutralized, 0.45);
  actor.prop.enabled = false;
  actor.root.setLocalEulerAngles(0, actor.root.getLocalEulerAngles().y, 78);
}

function fireShot(): void {
  if (state !== "playing") {
    startMission();
    return;
  }
  if (shots <= 0) return;
  shots -= 1;
  shotFlashTimer = 0.08;
  muzzleFlash.render!.material = getMaterial(COLORS.muzzle, 0.92);

  const hit = nearestActorOnAim();
  if (!hit) {
    setMissionText("Missed shot. Re-center the scope and watch movement patterns.");
  } else if (hit.role === "civilian") {
    hit.body.render!.material = getMaterial(COLORS.neutralized, 0.5);
    hit.head.render!.material = getMaterial(COLORS.neutralized, 0.45);
    endMission("lost", "Civilian hit. Mission failed.");
    return;
  } else {
    neutralize(hit);
    const remaining = actors.filter((actor) => actor.role === "hostile" && actor.alive).length;
    setMissionText(remaining === 0 ? "All bad actors are down. Civilians are safe." : `${remaining} bad actor${remaining === 1 ? "" : "s"} still active.`);
    if (remaining === 0) {
      endMission("won", "Mission complete. Bad actors neutralized.");
      return;
    }
  }

  if (shots === 0 && actors.some((actor) => actor.role === "hostile" && actor.alive)) {
    endMission("lost", "Out of shots. Bad actors escaped.");
    return;
  }
  updateHud();
}

function updateActors(dt: number): void {
  const time = performance.now() / 1000;
  for (const actor of actors) {
    if (!actor.alive) continue;
    const x = actor.baseX + Math.sin(time * actor.speed + actor.phase) * actor.amplitude;
    actor.root.setPosition(x, 0, actor.z);
    actor.root.lookAt(camera.getPosition().x, 0.7, camera.getPosition().z);

    const aimDistance = actorCenter(actor).distance(camera.getPosition().clone().add(cameraForward().mulScalar(23)));
    if (!actor.revealed && aimDistance < 3.4) {
      actor.revealed = true;
      setMissionText(actor.role === "hostile" ? `${actor.id}: weapon spotted. Red jacket confirmed hostile.` : `${actor.id}: blue civilian, do not fire.`);
    }
  }

  missionTime = Math.max(0, missionTime - dt);
  if (missionTime <= 0 && state === "playing") endMission("lost", "Too late. Bad actors escaped into the city.");
  updateHud();
}

function handleAimMove(e: PointerEvent): void {
  if (!pointerLast || state !== "playing") return;
  e.preventDefault();
  const dx = e.clientX - pointerLast.x;
  const dy = e.clientY - pointerLast.y;
  yaw -= dx * LOOK_SENSITIVITY;
  pitch += dy * LOOK_SENSITIVITY;
  pointerLast = { x: e.clientX, y: e.clientY };
  updateCameraAim();
}

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  if (state !== "playing") {
    startMission();
    return;
  }
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerLast = { x: e.clientX, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
});

stage.addEventListener("pointermove", handleAimMove);

stage.addEventListener("pointerup", (e: PointerEvent) => {
  e.preventDefault();
  if (pointerStart && state === "playing") {
    const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (moved < 8) fireShot();
  }
  pointerStart = null;
  pointerLast = null;
});

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  if (key === " " || key === "enter") {
    e.preventDefault();
    if (key === "enter" && state !== "playing") startMission();
    else fireShot();
  }
  if (state !== "playing") return;
  if (key === "arrowleft" || key === "a") yaw += 0.035;
  if (key === "arrowright" || key === "d") yaw -= 0.035;
  if (key === "arrowup" || key === "w") pitch -= 0.035;
  if (key === "arrowdown" || key === "s") pitch += 0.035;
  updateCameraAim();
});

fireBtn?.addEventListener("click", () => {
  fireShot();
});

restartBtn?.addEventListener("click", () => {
  startMission();
});

document.addEventListener(
  "gesturestart",
  (e: Event) => {
    e.preventDefault();
  },
  { passive: false },
);

function fitToStage(): void {
  const rect = stage.getBoundingClientRect();
  app.resizeCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

window.addEventListener("resize", fitToStage);
new ResizeObserver(fitToStage).observe(stage);

app.on("update", (dt: number) => {
  if (shotFlashTimer > 0) {
    shotFlashTimer = Math.max(0, shotFlashTimer - dt);
    if (shotFlashTimer === 0) muzzleFlash.render!.material = getMaterial(COLORS.muzzle, 0);
  }
  weaponRoot.setLocalEulerAngles(Math.sin(performance.now() / 140) * 0.35, 0, 0);
  if (state === "playing") updateActors(dt);
});

createCityBiome();
resetActors();
updateCameraAim();
updateHud();
fitToStage();
showOverlay("Rescue Marksman: protect civilians and eliminate red bad actors.");
app.start();
