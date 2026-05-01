/** Core tank arena rules — projectiles, walls, hit tests */

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FireProfile {
  cooldownMs: number;
  speed: number;
  damage: number;
  /** half-angle spread in radians for multi-shot */
  spread: number;
  count: number;
  pierce: number;
  radius: number;
}

export interface Loadout {
  id: string;
  name: string;
  nameDe: string;
  tankFile: string;
  bulletFile: string;
  fire: FireProfile;
}

export const ARENA = { W: 920, H: 540 };
export const TANK_HP = 100;
export const TANK_BODY_R = 22;
export const XP_PER_WIN = 28;
export const XP_STORAGE_KEY = "tank-wars-xp";

export const LOADOUTS: Loadout[] = [
  {
    id: "striker",
    name: "Striker",
    nameDe: "Stürmer",
    tankFile: "tankGreen.png",
    bulletFile: "bulletGreen.png",
    fire: { cooldownMs: 380, speed: 430, damage: 14, spread: 0, count: 1, pierce: 0, radius: 5 },
  },
  {
    id: "sniper",
    name: "Sniper",
    nameDe: "Scharfschütze",
    tankFile: "tankBlue.png",
    bulletFile: "bulletBlue.png",
    fire: { cooldownMs: 520, speed: 640, damage: 22, spread: 0, count: 1, pierce: 0, radius: 4 },
  },
  {
    id: "bruiser",
    name: "Bruiser",
    nameDe: "Panzer",
    tankFile: "tankRed.png",
    bulletFile: "bulletRed.png",
    fire: { cooldownMs: 720, speed: 260, damage: 36, spread: 0, count: 1, pierce: 0, radius: 8 },
  },
  {
    id: "scatter",
    name: "Scatter",
    nameDe: "Streuschuss",
    tankFile: "tankBeige.png",
    bulletFile: "bulletYellow.png",
    fire: { cooldownMs: 480, speed: 360, damage: 8, spread: 0.26, count: 3, pierce: 0, radius: 5 },
  },
  {
    id: "ghost",
    name: "Ghost",
    nameDe: "Geist",
    tankFile: "tankBlack.png",
    bulletFile: "bulletSilver.png",
    fire: { cooldownMs: 240, speed: 520, damage: 7, spread: 0, count: 1, pierce: 1, radius: 4 },
  },
];

export interface BulletSim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  pierceLeft: number;
  ownerIsPlayer: boolean;
}

export function clampToArena(x: number, y: number, r: number): [number, number] {
  return [
    Math.max(r + 4, Math.min(ARENA.W - r - 4, x)),
    Math.max(r + 4, Math.min(ARENA.H - r - 4, y)),
  ];
}

export function circleHitsWall(cx: number, cy: number, cr: number, walls: Wall[]): Wall | null {
  for (const w of walls) {
    const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
    const ny = Math.max(w.y, Math.min(cy, w.y + w.h));
    const dx = cx - nx;
    const dy = cy - ny;
    if (dx * dx + dy * dy < cr * cr) return w;
  }
  return null;
}

/** Multi-shot fan: evenly spaced from `base - halfSpread` to `base + halfSpread`. */
export function spreadAngles(base: number, count: number, halfSpread: number): number[] {
  if (count <= 1) return [base];
  const out: number[] = [];
  const span = 2 * halfSpread;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    out.push(base + t * (span / 2));
  }
  return out;
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function getLoadout(id: string): Loadout | undefined {
  return LOADOUTS.find((l) => l.id === id);
}

export function readStoredXp(): number {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(XP_STORAGE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addStoredXp(delta: number): number {
  const next = Math.max(0, readStoredXp() + delta);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(XP_STORAGE_KEY, String(next));
  } catch {
    /** ignore quota */
  }
  return next;
}

/** Gentle curve: level rises with √(xp). */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
}