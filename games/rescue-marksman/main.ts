import * as pc from "playcanvas";

const SHOTS_PER_MISSION = 5;
const MISSION_TIME = 75;
const LOOK_SENSITIVITY = 0.0032;
const YAW_LIMIT = 0.48;
const PITCH_MIN = -0.72;
const PITCH_MAX = -0.08;
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
type MonsterSet = "big" | "blob" | "flying";

interface MonsterDef {
  set: MonsterSet;
  file: string;
  scale: number;
  hover?: number;
  walkAnim?: string;
  idleAnim?: string;
  hitAnim?: string;
}

interface ActorSpec {
  id: string;
  role: ActorRole;
  baseX: number;
  z: number;
  speed: number;
  amplitude: number;
  phase: number;
  hp?: number;
  boss?: boolean;
  monster: MonsterDef;
}

interface LevelSpec {
  name: string;
  shots: number;
  time: number;
  intel: string;
  actors: ActorSpec[];
}

interface ProceduralBody {
  body: pc.Entity;
  head: pc.Entity;
  prop: pc.Entity;
  armor?: pc.Entity;
}

interface Actor {
  role: ActorRole;
  id: string;
  root: pc.Entity;
  visual: pc.Entity;
  procedural: ProceduralBody;
  marker?: pc.Entity;
  monster: MonsterDef;
  baseX: number;
  z: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  amplitude: number;
  phase: number;
  boss: boolean;
  alive: boolean;
  revealed: boolean;
  anim?: pc.AnimationComponent | null;
  modelLoaded: boolean;
  meshMaterials: pc.StandardMaterial[];
  hitTimer: number;
  motionState: "idle" | "walk";
}

interface ModelPlacement {
  file: string;
  name: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
}

interface MonsterContainerResource extends pc.ContainerResource {
  animations?: pc.Asset[];
}

type ContainerAsset = pc.Asset & { resource: MonsterContainerResource };

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const levelEl = document.getElementById("level");
const shotsEl = document.getElementById("shots");
const hostilesEl = document.getElementById("hostiles");
const civiliansEl = document.getElementById("civilians");
const timerEl = document.getElementById("timer");
const intelText = document.getElementById("intelText");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const fireBtn = document.getElementById("fireBtn");
const restartBtn = document.getElementById("restartBtn");

const M = {
  greenSpiky: { set: "blob", file: "GreenSpikyBlob.gltf", scale: 1.4, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  pinkBlob: { set: "blob", file: "PinkBlob.gltf", scale: 1.35, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  orc: { set: "big", file: "Orc.gltf", scale: 1.05, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  ninja: { set: "big", file: "Ninja.gltf", scale: 1.0, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  blueDemon: { set: "big", file: "BlueDemon.gltf", scale: 1.05, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  cactoro: { set: "big", file: "Cactoro.gltf", scale: 1.05, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  orcSkull: { set: "big", file: "Orc_Skull.gltf", scale: 1.1, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  yeti: { set: "big", file: "Yeti.gltf", scale: 1.55, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
  hywirl: { set: "flying", file: "Hywirl.gltf", scale: 1.2, hover: 1.6, walkAnim: "Flying_Idle", idleAnim: "Flying_Idle", hitAnim: "HitReact" },
  goleling: { set: "flying", file: "Goleling.gltf", scale: 1.2, hover: 1.4, walkAnim: "Flying_Idle", idleAnim: "Flying_Idle", hitAnim: "HitReact" },
  cat: { set: "blob", file: "Cat.gltf", scale: 1.2, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  dog: { set: "blob", file: "Dog.gltf", scale: 1.2, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  chicken: { set: "blob", file: "Chicken.gltf", scale: 1.1, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  pigeon: { set: "blob", file: "Pigeon.gltf", scale: 1.1, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitRecieve" },
  bunny: { set: "big", file: "Bunny.gltf", scale: 0.9, walkAnim: "Walk", idleAnim: "Idle", hitAnim: "HitReact" },
} as const satisfies Record<string, MonsterDef>;

const LEVELS: LevelSpec[] = [
  {
    name: "Rooftop Checkpoint",
    shots: 5,
    time: 70,
    intel: "Level 1: two red blob hostiles are moving near civilians. Take clean shots only.",
    actors: [
      { id: "hostile-a", role: "hostile", baseX: -4.8, z: -11.8, speed: 0.8, amplitude: 0.46, phase: 0, monster: M.greenSpiky },
      { id: "hostile-b", role: "hostile", baseX: 5.8, z: -8.8, speed: 0.64, amplitude: 0.38, phase: 2.0, monster: M.pinkBlob },
      { id: "civilian-a", role: "civilian", baseX: -6.8, z: -6.8, speed: 0.45, amplitude: 0.28, phase: 0.8, monster: M.cat },
      { id: "civilian-b", role: "civilian", baseX: 4.8, z: -12.0, speed: 0.5, amplitude: 0.3, phase: 2.9, monster: M.dog },
    ],
  },
  {
    name: "Market Street",
    shots: 5,
    time: 75,
    intel: "Level 2: three Orc/Ninja hostiles are spread across the street. Civilians are close to the targets.",
    actors: [
      { id: "hostile-a", role: "hostile", baseX: -6.1, z: -12.6, speed: 0.78, amplitude: 0.5, phase: 0.2, monster: M.orc },
      { id: "hostile-b", role: "hostile", baseX: 0.2, z: -14.7, speed: 0.55, amplitude: 0.36, phase: 1.3, monster: M.ninja },
      { id: "hostile-c", role: "hostile", baseX: 7.1, z: -8.8, speed: 0.7, amplitude: 0.42, phase: 2.4, monster: M.orc },
      { id: "civilian-a", role: "civilian", baseX: -3.8, z: -6.5, speed: 0.5, amplitude: 0.32, phase: 1.2, monster: M.bunny },
      { id: "civilian-b", role: "civilian", baseX: 5.5, z: -12.0, speed: 0.5, amplitude: 0.3, phase: 2.9, monster: M.chicken },
    ],
  },
  {
    name: "Crossfire Avenue",
    shots: 6,
    time: 80,
    intel: "Level 3: four flying suspects, more movement, and only a few extra rounds.",
    actors: [
      { id: "hostile-a", role: "hostile", baseX: -7.2, z: -15.0, speed: 0.85, amplitude: 0.54, phase: 0.1, monster: M.hywirl },
      { id: "hostile-b", role: "hostile", baseX: -1.9, z: -8.0, speed: 0.68, amplitude: 0.45, phase: 1.1, monster: M.goleling },
      { id: "hostile-c", role: "hostile", baseX: 3.7, z: -14.4, speed: 0.62, amplitude: 0.42, phase: 2.1, monster: M.hywirl },
      { id: "hostile-d", role: "hostile", baseX: 8.0, z: -5.8, speed: 0.74, amplitude: 0.42, phase: 3.0, monster: M.goleling },
      { id: "civilian-a", role: "civilian", baseX: -5.0, z: -6.2, speed: 0.48, amplitude: 0.32, phase: 0.8, monster: M.pigeon },
      { id: "civilian-b", role: "civilian", baseX: 1.6, z: -11.0, speed: 0.43, amplitude: 0.26, phase: 2.3, monster: M.cat },
      { id: "civilian-c", role: "civilian", baseX: 6.0, z: -13.4, speed: 0.52, amplitude: 0.3, phase: 3.4, monster: M.chicken },
    ],
  },
  {
    name: "Night Evacuation",
    shots: 6,
    time: 82,
    intel: "Level 4: BlueDemons and Cactoros use civilians as cover. Wait for separation before firing.",
    actors: [
      { id: "hostile-a", role: "hostile", baseX: -6.8, z: -7.7, speed: 0.95, amplitude: 0.62, phase: 0.5, monster: M.blueDemon },
      { id: "hostile-b", role: "hostile", baseX: -0.8, z: -14.8, speed: 0.76, amplitude: 0.46, phase: 1.4, monster: M.cactoro },
      { id: "hostile-c", role: "hostile", baseX: 4.0, z: -6.4, speed: 0.8, amplitude: 0.54, phase: 2.7, monster: M.blueDemon },
      { id: "hostile-d", role: "hostile", baseX: 7.8, z: -13.2, speed: 0.7, amplitude: 0.42, phase: 3.5, monster: M.cactoro },
      { id: "civilian-a", role: "civilian", baseX: -4.9, z: -7.4, speed: 0.56, amplitude: 0.35, phase: 1.6, monster: M.dog },
      { id: "civilian-b", role: "civilian", baseX: 2.9, z: -6.8, speed: 0.5, amplitude: 0.28, phase: 2.0, monster: M.bunny },
      { id: "civilian-c", role: "civilian", baseX: 6.0, z: -12.7, speed: 0.48, amplitude: 0.32, phase: 3.1, monster: M.pigeon },
    ],
  },
  {
    name: "Boss Convoy",
    shots: 10,
    time: 95,
    intel: "Final level: the Yeti boss survives 5 shots and is flanked by Orc Skull guards. You have 10 shots total.",
    actors: [
      { id: "boss", role: "hostile", baseX: 0.2, z: -12.8, speed: 0.45, amplitude: 0.32, phase: 0, hp: 5, boss: true, monster: M.yeti },
      { id: "guard-a", role: "hostile", baseX: -5.8, z: -9.8, speed: 0.8, amplitude: 0.48, phase: 1.2, monster: M.orcSkull },
      { id: "guard-b", role: "hostile", baseX: 5.7, z: -9.4, speed: 0.76, amplitude: 0.48, phase: 2.4, monster: M.orcSkull },
      { id: "civilian-a", role: "civilian", baseX: -3.3, z: -6.9, speed: 0.42, amplitude: 0.24, phase: 0.8, monster: M.cat },
      { id: "civilian-b", role: "civilian", baseX: 3.2, z: -6.7, speed: 0.45, amplitude: 0.26, phase: 2.9, monster: M.dog },
    ],
  },
];

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
let currentLevelIndex = 0;
let yaw = 0;
let pitch = -0.33;
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
  return camera.forward.clone().normalize();
}

function updateHud(): void {
  const hostiles = actors.filter((actor) => actor.role === "hostile" && actor.alive).length;
  const civilians = actors.filter((actor) => actor.role === "civilian" && actor.alive).length;
  setText(levelEl, `${currentLevelIndex + 1}/${LEVELS.length}`);
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

function buildProceduralBody(root: pc.Entity, spec: ActorSpec): ProceduralBody {
  const isBoss = spec.boss === true;
  const bodyColor = spec.role === "hostile" ? (isBoss ? new pc.Color(0.52, 0.04, 0.10) : COLORS.hostile) : COLORS.civilian;
  const bodyScale: [number, number, number] = isBoss ? [0.86, 1.55, 0.58] : [0.56, 1.05, 0.38];
  const bodyY = isBoss ? 1.0 : 0.76;
  const headY = isBoss ? 1.9 : 1.48;
  const body = makeBox(`${spec.id}-body`, bodyColor, bodyScale, [0, bodyY, 0], 1, root);
  const head = makeSphere(`${spec.id}-head`, COLORS.skin, isBoss ? [0.44, 0.44, 0.44] : [0.34, 0.34, 0.34], [0, headY, 0], 1, root);
  const prop =
    spec.role === "hostile"
      ? makeBox(`${spec.id}-weapon`, COLORS.weapon, isBoss ? [1.0, 0.14, 0.16] : [0.72, 0.11, 0.13], [0.42, isBoss ? 1.16 : 0.93, -0.15], 1, root)
      : makeBox(`${spec.id}-rescue-marker`, new pc.Color(0.15, 0.82, 0.42), [0.24, 0.24, 0.08], [0, 0.94, -0.21], 1, root);
  const armor = isBoss ? makeBox(`${spec.id}-armor`, new pc.Color(0.12, 0.02, 0.04), [0.56, 0.38, 0.06], [0, 1.12, -0.32], 1, root) : undefined;
  return { body, head, prop, armor };
}

function tintMonster(entity: pc.Entity, role: ActorRole, isBoss: boolean): pc.StandardMaterial[] {
  const tint = role === "civilian"
    ? new pc.Color(0.78, 0.92, 1.0)
    : isBoss
      ? new pc.Color(1.0, 0.55, 0.55)
      : new pc.Color(1.0, 0.78, 0.78);
  const collected: pc.StandardMaterial[] = [];
  const renders = entity.findComponents("render") as pc.RenderComponent[];
  for (const render of renders) {
    if (!render.meshInstances) continue;
    for (const meshInstance of render.meshInstances) {
      const original = meshInstance.material as pc.StandardMaterial | undefined;
      if (!original) continue;
      const cloned = original.clone() as pc.StandardMaterial;
      cloned.diffuse = new pc.Color(
        Math.min(1, cloned.diffuse.r * tint.r),
        Math.min(1, cloned.diffuse.g * tint.g),
        Math.min(1, cloned.diffuse.b * tint.b),
      );
      cloned.update();
      meshInstance.material = cloned;
      collected.push(cloned);
    }
  }
  return collected;
}

function attachMonster(actor: Actor, asset: pc.Asset): void {
  const container = (asset as ContainerAsset).resource;
  const entity = container.instantiateRenderEntity({ castShadows: false });
  entity.name = `${actor.id}-monster`;
  entity.setLocalScale(actor.monster.scale, actor.monster.scale, actor.monster.scale);
  entity.setLocalPosition(0, actor.monster.hover ?? 0, 0);
  actor.root.addChild(entity);

  for (const child of actor.procedural.body.children.slice()) child.destroy();
  actor.procedural.body.enabled = false;
  actor.procedural.head.enabled = false;
  actor.procedural.prop.enabled = false;
  if (actor.procedural.armor) actor.procedural.armor.enabled = false;
  actor.visual = entity;
  actor.modelLoaded = true;
  actor.meshMaterials = tintMonster(entity, actor.role, actor.boss);

  const animations = container.animations ?? [];
  if (animations.length > 0) {
    entity.addComponent("animation", { activate: true, loop: true, speed: 1 });
    const animComponent = entity.animation as pc.AnimationComponent | null;
    if (animComponent) {
      animComponent.assets = animations.map((a: pc.Asset) => a.id);
      const startAnim = actor.monster.walkAnim ?? "Walk";
      try {
        animComponent.play(startAnim, 0.2);
      } catch (err) {
        console.warn(`Could not start animation ${startAnim} on ${actor.id}`, err);
      }
      actor.anim = animComponent;
      actor.motionState = "walk";
    }
  }
}

function loadMonsterFor(actor: Actor): void {
  const url = `${MODEL_BASE}monsters/${actor.monster.set}/${actor.monster.file}`;
  app.assets.loadFromUrl(url, "container", (err: string | null, asset?: pc.Asset) => {
    if (err || !asset?.resource) {
      console.warn(`Could not load monster ${actor.monster.file}`, err);
      return;
    }
    if (!actor.root || actor.root.parent === null) return;
    attachMonster(actor, asset);
  });
}

function createActor(spec: ActorSpec): Actor {
  const root = new pc.Entity(`${spec.id}-root`);
  root.setPosition(spec.baseX, 0, spec.z);
  app.root.addChild(root);
  const isBoss = spec.boss === true;
  const procedural = buildProceduralBody(root, spec);
  const hp = spec.hp ?? (isBoss ? 5 : 1);
  const isFlyer = spec.monster.set === "flying";
  const aimHeight = isFlyer
    ? (spec.monster.hover ?? 1.4) + 0.4
    : isBoss
      ? 1.4
      : spec.role === "hostile"
        ? 0.85
        : 0.7;

  let marker: pc.Entity | undefined;
  if (spec.role === "civilian") {
    marker = makeBox(`${spec.id}-marker`, new pc.Color(0.18, 0.7, 1.0), [1.1, 0.04, 1.1], [0, 0.04, 0], 0.55, root);
  } else if (isBoss) {
    marker = makeBox(`${spec.id}-marker`, new pc.Color(0.85, 0.10, 0.18), [1.6, 0.04, 1.6], [0, 0.04, 0], 0.7, root);
  }

  const actor: Actor = {
    role: spec.role,
    id: spec.id,
    root,
    visual: root,
    procedural,
    marker,
    monster: spec.monster,
    baseX: spec.baseX,
    z: spec.z,
    y: aimHeight,
    radius: isBoss ? 1.1 : spec.role === "hostile" ? 0.7 : 0.6,
    hp,
    maxHp: hp,
    speed: spec.speed,
    amplitude: spec.amplitude,
    phase: spec.phase,
    boss: isBoss,
    alive: true,
    revealed: false,
    anim: null,
    modelLoaded: false,
    meshMaterials: [],
    hitTimer: 0,
    motionState: "walk",
  };

  loadMonsterFor(actor);
  return actor;
}

function resetActors(): void {
  for (const actor of actors) actor.root.destroy();
  actors.length = 0;
  for (const spec of LEVELS[currentLevelIndex].actors) actors.push(createActor(spec));
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
  if (state === "won") {
    currentLevelIndex = currentLevelIndex < LEVELS.length - 1 ? currentLevelIndex + 1 : 0;
  }
  const level = LEVELS[currentLevelIndex];
  state = "playing";
  shots = level.shots;
  missionTime = level.time;
  yaw = 0;
  pitch = -0.33;
  shotFlashTimer = 0;
  resetActors();
  updateCameraAim();
  updateHud();
  setMissionText(level.intel);
  hideOverlay();
}

function fadeActorTint(actor: Actor, color: pc.Color, amount: number): void {
  if (actor.meshMaterials.length === 0) {
    if (actor.procedural.body.render) actor.procedural.body.render.material = getMaterial(color, 0.55);
    if (actor.procedural.head.render) actor.procedural.head.render.material = getMaterial(color, 0.45);
    return;
  }
  for (const material of actor.meshMaterials) {
    material.diffuse = new pc.Color(
      pc.math.lerp(material.diffuse.r, color.r, amount),
      pc.math.lerp(material.diffuse.g, color.g, amount),
      pc.math.lerp(material.diffuse.b, color.b, amount),
    );
    material.update();
  }
}

function playActorAnim(actor: Actor, animName: string | undefined, blend = 0.15): boolean {
  if (!animName || !actor.anim) return false;
  try {
    actor.anim.play(animName, blend);
    return true;
  } catch (err) {
    console.warn(`Animation ${animName} failed on ${actor.id}`, err);
    return false;
  }
}

function neutralize(actor: Actor): void {
  actor.alive = false;
  actor.hitTimer = 0;
  fadeActorTint(actor, COLORS.neutralized, 0.7);
  actor.procedural.prop.enabled = false;
  if (actor.marker) actor.marker.enabled = false;
  if (!playActorAnim(actor, "Death", 0.1)) {
    actor.root.setLocalEulerAngles(0, actor.root.getLocalEulerAngles().y, 78);
  } else if (actor.anim) {
    actor.anim.loop = false;
  }
  actor.motionState = "idle";
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
    fadeActorTint(hit, COLORS.neutralized, 0.7);
    if (!playActorAnim(hit, "Death", 0.1)) {
      hit.procedural.body.render!.material = getMaterial(COLORS.neutralized, 0.5);
      hit.procedural.head.render!.material = getMaterial(COLORS.neutralized, 0.45);
    } else if (hit.anim) {
      hit.anim.loop = false;
    }
    hit.alive = false;
    endMission("lost", "Civilian hit. Mission failed.");
    return;
  } else {
    hit.hp -= 1;
    if (hit.hp > 0) {
      fadeActorTint(hit, COLORS.hit, 0.45);
      hit.hitTimer = 0.55;
      if (!playActorAnim(hit, hit.monster.hitAnim ?? "HitReact", 0.05)) {
        if (hit.procedural.body.render) hit.procedural.body.render.material = getMaterial(COLORS.hit, 0.92);
      }
      setMissionText(hit.boss ? `Boss hit. Armor holding: ${hit.hp}/${hit.maxHp} health left.` : `${hit.id} is hit but still moving.`);
    } else {
      neutralize(hit);
    }
    const remaining = actors.filter((actor) => actor.role === "hostile" && actor.alive).length;
    if (hit.hp <= 0) {
      setMissionText(remaining === 0 ? "All bad actors are down. Civilians are safe." : `${remaining} bad actor${remaining === 1 ? "" : "s"} still active.`);
    }
    if (remaining === 0) {
      const isFinalLevel = currentLevelIndex === LEVELS.length - 1;
      endMission("won", isFinalLevel ? "Campaign complete. Boss neutralized." : `Level ${currentLevelIndex + 1} clear. Tap for level ${currentLevelIndex + 2}.`);
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
    const phaseValue = time * actor.speed + actor.phase;
    const x = actor.baseX + Math.sin(phaseValue) * actor.amplitude;
    const baseY = actor.monster.hover ?? 0;
    const hoverY = actor.monster.hover ? Math.sin(phaseValue * 1.3) * 0.18 : 0;
    actor.root.setPosition(x, baseY + hoverY, actor.z);
    actor.root.lookAt(camera.getPosition().x, baseY + 0.7, camera.getPosition().z);

    if (actor.hitTimer > 0) {
      actor.hitTimer = Math.max(0, actor.hitTimer - dt);
      if (actor.hitTimer === 0 && actor.alive) {
        playActorAnim(actor, actor.monster.walkAnim ?? "Walk", 0.2);
        actor.motionState = "walk";
      }
    } else if (actor.anim && actor.modelLoaded) {
      const moving = Math.abs(Math.cos(phaseValue) * actor.amplitude * actor.speed) > 0.18;
      const desired: "idle" | "walk" = moving ? "walk" : "idle";
      if (desired !== actor.motionState) {
        const animName = desired === "walk" ? actor.monster.walkAnim : actor.monster.idleAnim;
        if (playActorAnim(actor, animName, 0.25)) actor.motionState = desired;
      }
    }

    const aimDistance = actorCenter(actor).distance(camera.getPosition().clone().add(cameraForward().mulScalar(23)));
    if (!actor.revealed && aimDistance < 3.4) {
      actor.revealed = true;
      setMissionText(
        actor.role === "hostile"
          ? actor.boss
            ? `${actor.id}: Yeti boss confirmed. Requires ${actor.maxHp} direct hits.`
            : `${actor.id}: hostile creature confirmed.`
          : `${actor.id}: friendly creature, do not fire.`,
      );
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
  pitch -= dy * LOOK_SENSITIVITY;
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
  if (key === "arrowup" || key === "w") pitch += 0.035;
  if (key === "arrowdown" || key === "s") pitch -= 0.035;
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
showOverlay("Rescue Marksman: tap to start. Eliminate red-tinted monsters and protect blue-tinted critters.");
app.start();
