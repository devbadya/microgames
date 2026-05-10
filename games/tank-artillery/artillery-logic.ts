/** Zug-Arillerie — Terrain-Stichprobe (Y nach unten), Ballistik
 * Welt breit wie mobiles Artillery (lange Distanz), etwas weniger G für hängenden Bogen */
export const WORLD = { W: 1680, H: 720, G: 1580 };

/** Quadratischer Luftwiderstand: `v *= max(ε, 1 - K * |v| * dt * dragMul)` pro Schritt — gleiche Form in Sim und Vorschau. */
export const BALLISTIC_DRAG_K = 1.65e-4;

/** Wind schwankt leicht entlang der Flugbahn (deterministisch aus Startpunkt + Schritt). */
export const BALLISTIC_WIND_GUST_AMP = 0.095;
export const BALLISTIC_WIND_GUST_FREQ = 0.0082;

function gustPhase(x0: number, y0: number, windBase: number): number {
  let p = (x0 * 0.0193 + y0 * 0.0117 + windBase * 0.37) % (Math.PI * 2);
  if (p < 0) p += Math.PI * 2;
  return p;
}

function windAccelAtStep(windBase: number, stepIndex: number, x0: number, y0: number): number {
  const phase = gustPhase(x0, y0, windBase);
  const gust = 1 + BALLISTIC_WIND_GUST_AMP * Math.sin(stepIndex * BALLISTIC_WIND_GUST_FREQ + phase);
  return windBase * gust;
}

function applyQuadraticAirDrag(vx: number, vy: number, dt: number, dragMul: number): { vx: number; vy: number } {
  const sp = Math.hypot(vx, vy);
  if (sp < 1e-5) return { vx, vy };
  const damp = BALLISTIC_DRAG_K * dragMul * sp * dt;
  const factor = Math.max(0.02, 1 - damp);
  return { vx: vx * factor, vy: vy * factor };
}

export interface TerrainSurface {
  /** Oberflächen-Y für jede Ganzzahl x ∈ [0, W−1]; größer = tiefer im Bildschirm */
  y: Float32Array;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return (((t ^ (t >>> 14)) >>> 0) % 4294967296) / 4294967296;
  };
}

function boxBlurHorizontal(y: Float32Array, width: number, radius: number, passes: number): void {
  const tmp = new Float32Array(width);
  for (let p = 0; p < passes; p++) {
    tmp.set(y);
    for (let x = 0; x < width; x++) {
      let s = 0;
      let c = 0;
      for (let k = -radius; k <= radius; k++) {
        const xi = Math.max(0, Math.min(width - 1, x + k));
        s += tmp[xi]!;
        c++;
      }
      y[x] = s / c;
    }
  }
}

/** Gelände-Schwierigkeit: Amplitude und Glättung — „insane“ ist extrem und erst spät freigeschaltet (UI). */
export type TerrainDifficulty = "easy" | "normal" | "hard" | "insane";

export const MAP_DIFFICULTY_STORAGE_KEY = "tank-artillery-map-difficulty-v1";
export const MAP_BATTLE_THEME_STORAGE_KEY = "tank-artillery-map-theme-v1";

/** Kampf-Hintergrund — „moon“ = dunkler Himmel + graue Regolith-Farben auf dem Terrain. */
export type MapBattleTheme = "earth" | "moon";

const TERRAIN_DIFFICULTY_IDS: ReadonlySet<TerrainDifficulty> = new Set(["easy", "normal", "hard", "insane"]);
const MAP_BATTLE_THEME_IDS: ReadonlySet<MapBattleTheme> = new Set(["earth", "moon"]);

const TERRAIN_PRESETS: Record<
  TerrainDifficulty,
  { ampFrac: number; blurR: number; blurP: number; hfMul: number }
> = {
  /** Sanfter, weich gezeichnet — gut Zielen lernen */
  easy: { ampFrac: 0.044, blurR: 17, blurP: 11, hfMul: 0.78 },
  /** Vorheriges Standard-Gelände */
  normal: { ampFrac: 0.062, blurR: 14, blurP: 10, hfMul: 1 },
  /** Steilere Hügel, mehr Kleinkrümmung nach dem Weichzeichnen */
  hard: { ampFrac: 0.084, blurR: 10, blurP: 7, hfMul: 1.38 },
  /** Extrem: sehr hohes Relief, weniger Glättung, starke HF-Krümmung — bewusst „unfair schwer“. */
  insane: { ampFrac: 0.162, blurR: 5, blurP: 4, hfMul: 2.52 },
};

export interface BuildTerrainOptions {
  difficulty?: TerrainDifficulty;
  /** Optional: alternative Map-Breite (y-Länge). Default = {@link WORLD.W}. */
  width?: number;
}

/** Weiche, rollige Hügel — `difficulty` steuert Höhe und Rauheit (Standard: normal). */
export function buildTerrain(seed: number, opts?: BuildTerrainOptions): TerrainSurface {
  const preset = TERRAIN_PRESETS[opts?.difficulty ?? "normal"];
  const rnd = mulberry32(seed);
  const width = Math.max(64, Math.floor(opts?.width ?? WORLD.W));
  const y = new Float32Array(width);
  const base = WORLD.H * 0.52;
  const amp = WORLD.H * preset.ampFrac;
  const ph = rnd() * Math.PI * 2;
  const hf = preset.hfMul;
  for (let x = 0; x < width; x++) {
    const u = (x / width) * Math.PI * 2;
    const waves =
      Math.sin(u * 1.45 + ph) * 1 +
      Math.sin(u * 2.85 + ph * 1.6) * 0.42 +
      Math.sin(u * 4.9 + ph * 0.85) * (0.16 * hf) +
      Math.sin(u * 0.62 + ph * 0.35) * 0.38;
    const val = base + amp * waves;
    y[x] = Math.min(WORLD.H * 0.88, Math.max(WORLD.H * 0.43, val));
  }
  boxBlurHorizontal(y, width, preset.blurR, preset.blurP);
  return { y };
}

export function readMapDifficulty(): TerrainDifficulty {
  try {
    if (typeof localStorage === "undefined") return "normal";
    const raw = localStorage.getItem(MAP_DIFFICULTY_STORAGE_KEY);
    if (raw === "easy" || raw === "normal" || raw === "hard" || raw === "insane") return raw;
  } catch {
    /** ignore */
  }
  return "normal";
}

export function setMapDifficulty(next: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    const id: TerrainDifficulty = TERRAIN_DIFFICULTY_IDS.has(next as TerrainDifficulty)
      ? (next as TerrainDifficulty)
      : "normal";
    localStorage.setItem(MAP_DIFFICULTY_STORAGE_KEY, id);
  } catch {
    /** ignore */
  }
}

export function readMapBattleTheme(): MapBattleTheme {
  try {
    if (typeof localStorage === "undefined") return "earth";
    const raw = localStorage.getItem(MAP_BATTLE_THEME_STORAGE_KEY);
    if (raw === "earth" || raw === "moon") return raw;
  } catch {
    /** ignore */
  }
  return "earth";
}

export function setMapBattleTheme(next: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    const id: MapBattleTheme = MAP_BATTLE_THEME_IDS.has(next as MapBattleTheme)
      ? (next as MapBattleTheme)
      : "earth";
    localStorage.setItem(MAP_BATTLE_THEME_STORAGE_KEY, id);
  } catch {
    /** ignore */
  }
}

export function heightAt(surface: TerrainSurface, x: number): number {
  const w = surface.y.length;
  if (x <= 0) return surface.y[0]!;
  if (x >= w - 1) return surface.y[w - 1]!;
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = x - x0;
  return surface.y[x0]! * (1 - t) + surface.y[x1]! * t;
}

/** Hangtangente für Sprite-Rotation (Bogenmaß, Uhrzeigersinn wie Canvas). */
export function terrainSlope(surface: TerrainSurface, x: number): number {
  const dl = 12;
  const yl = heightAt(surface, x - dl);
  const yr = heightAt(surface, x + dl);
  return Math.atan2(yr - yl, dl * 2);
}

export interface TerrainHullPoseOptions {
  sampleCount?: number;
  maxSlopeRad?: number;
}

export interface TerrainHullPose {
  groundY: number;
  slope: number;
  rawSlope: number;
  maxClearancePx: number;
}

function clampNumber(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Median (sortiert aufsteigend: kleineres Y = höher auf dem Bildschirm). */
function medianSortedAsc(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function averageHeightAt(surface: TerrainSurface, centerX: number, radiusPx: number): number {
  const samples = 5;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    sum += heightAt(surface, centerX + (t * 2 - 1) * radiusPx);
  }
  return sum / samples;
}

/** Max. wie weit die tiefste Stelle unter der Median-Unterkante ziehen darf (px, Y nach unten). */
const HULL_GROUND_MEDIAN_PULL_CAP_PX = 52;

/**
 * Computes a stable pose for a tank hull on uneven terrain.
 *
 * The hull bottom is treated as a straight support line over several terrain
 * samples. Unterkante = min(tiefster Punkt, Median + Kappe): schmale Krater
 * ziehen den Panzer nicht mehr vollständig in die Grube; breite Mulden bleiben
 * weiterhin überwiegend erreichbar.
 */
export function terrainHullPose(
  surface: TerrainSurface,
  centerX: number,
  footprintHalfPx: number,
  opts?: TerrainHullPoseOptions,
): TerrainHullPose {
  const width = surface.y.length;
  const half = Math.max(4, footprintHalfPx);
  const cx = clampNumber(centerX, 0, width - 1);
  const left = clampNumber(cx - half, 0, width - 1);
  const right = clampNumber(cx + half, 0, width - 1);
  const span = Math.max(1, right - left);
  const band = Math.max(3, Math.min(half * 0.24, 14));
  const leftY = averageHeightAt(surface, left, band);
  const rightY = averageHeightAt(surface, right, band);
  const rawSlope = Math.atan2(rightY - leftY, span);
  const maxSlopeRad = opts?.maxSlopeRad ?? Math.PI / 6;
  const slope = clampNumber(rawSlope, -maxSlopeRad, maxSlopeRad);
  const tan = Math.tan(slope);
  const sampleCount = Math.max(3, Math.min(17, Math.floor(opts?.sampleCount ?? 9)));

  const samples: Array<{ x: number; y: number }> = [];
  const adjusted: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount === 1 ? 0.5 : i / (sampleCount - 1);
    const x = left + span * t;
    const y = heightAt(surface, x);
    samples.push({ x, y });
    adjusted.push(y - tan * (x - cx));
  }
  const sortedAdj = [...adjusted].sort((a, b) => a - b);
  const deepest = sortedAdj[sortedAdj.length - 1]!;
  const med = medianSortedAsc(sortedAdj);
  const groundY = Math.min(deepest, med + HULL_GROUND_MEDIAN_PULL_CAP_PX);

  let maxClearancePx = 0;
  for (const s of samples) {
    const supportY = groundY + tan * (s.x - cx);
    maxClearancePx = Math.max(maxClearancePx, supportY - s.y);
  }

  return { groundY, slope, rawSlope, maxClearancePx };
}

export interface BarrelRayBlockOptions {
  /** Toleranz unterhalb der Oberfläche (px), um Gleitkomma-Rauschen zu vermeiden. */
  marginPx?: number;
  /** Schrittweite entlang des Rohrs (Welt-px). */
  sampleStep?: number;
}

/**
 * Prüft, ob die Rohrachse (Turm‑Pivot → Mündung) die Terrain-Oberfläche schneidet oder die Mündung im Boden liegt.
 * Koordinaten wie im Spiel: größeres Y = tiefer im Bild; Luft liegt oberhalb der Oberfläche (kleineres Y).
 */
export function terrainBlocksBarrelRay(
  surface: TerrainSurface,
  hullX: number,
  pivotScreenY: number,
  angleDeg: number,
  isLeft: boolean,
  barrelLenPx: number,
  opts?: BarrelRayBlockOptions,
): boolean {
  const marginPx = opts?.marginPx ?? 4;
  const sampleStep = Math.max(1.5, opts?.sampleStep ?? 3);
  const r = Math.max(13, Math.min(88, angleDeg)) * (Math.PI / 180);
  const dirX = Math.cos(r) * (isLeft ? 1 : -1);
  const dirY = -Math.sin(r);
  const w = surface.y.length;

  const tipX = hullX + dirX * barrelLenPx;
  if (tipX >= 0 && tipX < w) {
    const tipY = pivotScreenY + dirY * barrelLenPx;
    if (tipY >= heightAt(surface, tipX) - marginPx) return true;
  }

  for (let s = sampleStep; s < barrelLenPx - 0.5; s += sampleStep) {
    const x = hullX + dirX * s;
    if (x < 0 || x >= w) continue;
    const y = pivotScreenY + dirY * s;
    const g = heightAt(surface, x);
    if (y >= g - marginPx) return true;
  }
  return false;
}

/** Viele kleine Geschosse (z. B. Silber „Splitterhagel“); `dmg`/`splashPx`/… gelten **pro** Kugel. */
export interface PelletBurstConfig {
  count: number;
  /** Zufällige Winkelstreuung ±° um den gezielten Elevationswinkel */
  spreadHalfDeg: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  nameDe: string;
  /** Kenney `SubTexture` (Referenz / zukünftige Sprite-Zuordnung) */
  packLabel: string;
  dmg: number;
  splashPx: number;
  craterPx: number;
  craterLift: number;
  velMul: number;
  /** >1 = mehr Luftwiderstand, <1 = strömungsgünstiger (schweres Geschoss). Default 1. */
  ballisticDragMul?: number;
  /**
   * Splash-Falloff: Schaden proportional zu (1 − d/splashPx)^p.
   * `1` = linear (Standard); z. B. `3.5` = am Rand fast kein Schaden, in der Mitte volles `dmg`.
   */
  splashFalloffPow?: number;
  /**
   * Im Splash-Radius: zuerst dieser fester Anteil, dann Falloff-Splash aus (`dmg` − Wert).
   * Lehrgranate: Einschlag, danach Druckwelle.
   */
  directHitBeforeSplashDmg?: number;
  /** Leucht-Farben für Geschoss-In-Flight (Panzer-spezifische Optik) */
  glow?: ProjectileGlow;
  pelletBurst?: PelletBurstConfig;
  /**
   * Kein Geschoss: Leertaste im Ziel startet den Bunker-Siegelaser (5 s, 1×/Runde).
   * `dmg`/`splashPx`/… werden für Ballistik nicht genutzt.
   */
  siegeLaser?: boolean;
}

export interface ProjectileGlow {
  core: string;
  mid: string;
  rim: string;
  shadow: string;
}

/** Standard-Geschoss-Leuchten — Panzerwahl kann abweichen */
export const DEFAULT_PROJECTILE_GLOW: ProjectileGlow = {
  core: "rgba(255,251,210,0.95)",
  mid: "rgba(251,191,36,0.45)",
  rim: "rgba(249,115,22,0)",
  shadow: "rgba(251,146,60,0.75)",
};

/** Anzeige-Name Blitz-Inventar (1× pro Partie möglich) */
export const BLITZ_DISPLAY_NAME_DE = "Blitz";

/** Eigene Geschoss-Typen (Splash / Krater geschätzt wie Artillerie) */
export const WEAPONS: WeaponDef[] = [
  {
    id: "granate",
    name: "HE shell",
    nameDe: "Granate",
    packLabel: "tank_bullet1.png",
    dmg: 44,
    splashPx: 58,
    craterPx: 42,
    craterLift: 32,
    velMul: 1,
  },
  {
    id: "schwer",
    name: "Heavy bore",
    nameDe: "Schwer",
    packLabel: "tank_bullet3.png",
    dmg: 62,
    splashPx: 52,
    craterPx: 68,
    craterLift: 55,
    velMul: 0.92,
    ballisticDragMul: 0.88,
  },
  {
    id: "streuer",
    name: "Burst",
    nameDe: "Streuschuss",
    packLabel: "tank_bulletFly3.png",
    dmg: 32,
    splashPx: 72,
    craterPx: 28,
    craterLift: 18,
    velMul: 1.06,
    ballisticDragMul: 1.06,
  },
];

const GLOW_SILVER: ProjectileGlow = {
  core: "rgba(241,245,249,0.96)",
  mid: "rgba(148,163,184,0.5)",
  rim: "rgba(71,85,105,0)",
  shadow: "rgba(148,163,184,0.6)",
};
const GLOW_NAVY: ProjectileGlow = {
  core: "rgba(224,242,254,0.95)",
  mid: "rgba(56,189,248,0.5)",
  rim: "rgba(14,165,233,0)",
  shadow: "rgba(125,211,252,0.75)",
};
const GLOW_DESERT: ProjectileGlow = {
  core: "rgba(254,249,195,0.98)",
  mid: "rgba(251,146,60,0.55)",
  rim: "rgba(239,68,68,0)",
  shadow: "rgba(251,113,133,0.78)",
};
const GLOW_CRIMSON: ProjectileGlow = {
  core: "rgba(255,237,213,0.98)",
  mid: "rgba(248,113,113,0.56)",
  rim: "rgba(185,28,28,0)",
  shadow: "rgba(239,68,68,0.82)",
};
const GLOW_BUNKER: ProjectileGlow = {
  core: "rgba(226,232,240,0.96)",
  mid: "rgba(129,140,248,0.5)",
  rim: "rgba(67,56,202,0)",
  shadow: "rgba(99,102,241,0.78)",
};
/** Ultra-Bunker-Munition — violett / Magenta-Kern */
const GLOW_BUNKER_MYTHIC: ProjectileGlow = {
  core: "rgba(250,245,255,0.98)",
  mid: "rgba(192,38,211,0.58)",
  rim: "rgba(88,28,135,0)",
  shadow: "rgba(168,85,247,0.9)",
};
const GLOW_VIPER: ProjectileGlow = {
  core: "rgba(240,253,244,0.97)",
  mid: "rgba(74,222,128,0.52)",
  rim: "rgba(22,101,52,0)",
  shadow: "rgba(34,197,94,0.86)",
};
const GLOW_VIPER_POISON: ProjectileGlow = {
  core: "rgba(220,252,231,0.97)",
  mid: "rgba(34,197,94,0.54)",
  rim: "rgba(20,83,45,0)",
  shadow: "rgba(22,101,52,0.84)",
};

const GLOW_GREEN_A: ProjectileGlow = {
  core: "rgba(220,252,231,0.96)",
  mid: "rgba(52,211,153,0.48)",
  rim: "rgba(16,185,129,0)",
  shadow: "rgba(34,197,94,0.72)",
};
const GLOW_GREEN_B: ProjectileGlow = {
  core: "rgba(187,247,208,0.96)",
  mid: "rgba(34,197,94,0.5)",
  rim: "rgba(22,163,74,0)",
  shadow: "rgba(21,128,61,0.78)",
};
const GLOW_GREEN_C: ProjectileGlow = {
  core: "rgba(236,253,245,0.95)",
  mid: "rgba(110,231,183,0.44)",
  rim: "rgba(5,150,105,0)",
  shadow: "rgba(16,185,129,0.65)",
};

export type PlayerTankId = "silver" | "green" | "navy" | "desert" | "crimson" | "bunker" | "viper";
export type PlayerTankCustomSprite = "redStriker" | "viperEnergy" | "bunkerShield";

/** ATLAS-Schlüssel Kenney „Tanks“ */
export type PlayerTankAtlasKey =
  | "tankGrey"
  | "tankPlayerGreen"
  | "tankNavy"
  | "tankDesert"
  | "tankCrimson"
  | "tankBunker"
  | "tankViper";

export interface PlayerTankDef {
  id: PlayerTankId;
  nameDe: string;
  subtitleDe: string;
  /** 💎 Shop-Preis (steigt mit Kampfstärke; Silber = 0 Starter) */
  priceGems: number;
  atlasSprite: PlayerTankAtlasKey;
  /** Max. LP zu Partiebeginn (Spieler & Gegner gleich für faires Match) */
  maxHp: number;
  weapons: WeaponDef[];
  /** Optionales 4-Frame-Sprite-Sheet für animierte Premium-Panzer. */
  customSprite?: PlayerTankCustomSprite;
  /** Blitz relativ zu LIGHTNING_DAMAGE */
  blitzMul: number;
}

/** Feld-Green — günstigstes Upgrade nach Silber */
export const GEM_PRICE_TANK_GREEN = 100;
/** Marine — mittlere Tier-Stufe */
export const GEM_PRICE_TANK_NAVY = 280;
/** Wüsten-Speer — schweres Mittelfeld-Kit */
export const GEM_PRICE_TANK_DESERT = 550;
/** Roter Keil — schweres Angriffschassis */
export const GEM_PRICE_TANK_CRIMSON = 760;
/** Bunker-Titan — exklusiv inkl. Siegelaser (Kampf · Taste 8). */
export const GEM_PRICE_TANK_BUNKER = 10_000;
/** Viper-Green — spätes Schnellfeuer-Modell (über Bunker-Exklusivpreis) */
export const GEM_PRICE_TANK_VIPER = 12_000;

/** @deprecated Alias für {@link GEM_PRICE_TANK_GREEN} */
export const GEM_PRICE_NEW_TANK = GEM_PRICE_TANK_GREEN;

const SILVER_WEAPONS: WeaponDef[] = [
  {
    id: "silv_pop",
    name: "Drill round",
    nameDe: "Lehrgranate",
    packLabel: "tank_bullet1.png",
    dmg: 38,
    splashPx: 78,
    craterPx: 22,
    craterLift: 12,
    velMul: 1.08,
    glow: GLOW_SILVER,
    ballisticDragMul: 1.05,
    directHitBeforeSplashDmg: 14,
    splashFalloffPow: 3.5,
  },
  {
    id: "silv_med",
    name: "Chassis HE",
    nameDe: "Chassis-HE",
    packLabel: "tank_bullet3.png",
    dmg: 36,
    splashPx: 44,
    craterPx: 32,
    craterLift: 24,
    velMul: 1.02,
    glow: GLOW_SILVER,
    ballisticDragMul: 1.02,
    splashFalloffPow: 2.15,
  },
  {
    id: "silv_burst",
    name: "Shrapnel hail",
    nameDe: "Splitterhagel",
    packLabel: "tank_bulletFly3.png",
    dmg: 6,
    splashPx: 20,
    craterPx: 10,
    craterLift: 6,
    velMul: 1.12,
    glow: GLOW_SILVER,
    pelletBurst: { count: 18, spreadHalfDeg: 6 },
    ballisticDragMul: 1.08,
  },
];

/** Geschoss-Silhouette für Canvas-Chassis (nicht Silber-PNG): leicht / schwer / Streu. */
export type WeaponShellKind = "light" | "heavy" | "swarm";

/** Aus Kenney-`packLabel` — gleiche Logik für alle Panzer. */
export function packLabelToShellKind(packLabel: string): WeaponShellKind {
  if (packLabel.includes("bulletFly")) return "swarm";
  if (packLabel.includes("bullet3")) return "heavy";
  return "light";
}

function weaponPackLabelLookup(id: string): string | undefined {
  for (const w of WEAPONS) {
    if (w.id === id) return w.packLabel;
  }
  for (const tank of PLAYER_TANKS) {
    for (const w of tank.weapons) {
      if (w.id === id) return w.packLabel;
    }
    const sp = LOCKER_MAX_SPECIAL_WEAPONS[tank.id];
    if (sp.id === id) return sp.packLabel;
  }
  if (VIPER_GIFT_BOMB_WEAPON.id === id) return VIPER_GIFT_BOMB_WEAPON.packLabel;
  return undefined;
}

export function shellKindForWeaponId(id: string): WeaponShellKind {
  const p = weaponPackLabelLookup(id);
  if (!p) return "light";
  return packLabelToShellKind(p);
}

function flightProfileHash(weaponId: string): number {
  let h = 2166136261;
  for (let i = 0; i < weaponId.length; i++) {
    h ^= weaponId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Canvas-Optik pro Waffe: Silber-PNG fest; sonst Chassis-Silhouette + leichte Streuung je ID. */
export function weaponProjectileFlightVisualProfile(weaponId: string): {
  singleScale: number;
  pelletScaleMul: number;
  shadowBlur: number;
  pickerPreviewMul: number;
} {
  if (!weaponId) return { singleScale: 1, pelletScaleMul: 1, shadowBlur: 14, pickerPreviewMul: 1 };
  switch (weaponId) {
    case "bnk_siege_laser":
      return { singleScale: 1.05, pelletScaleMul: 1, shadowBlur: 28, pickerPreviewMul: 1.05 };
    case "silv_pop":
      return { singleScale: 0.76, pelletScaleMul: 1, shadowBlur: 9, pickerPreviewMul: 0.88 };
    case "silv_med":
      return { singleScale: 1.07, pelletScaleMul: 1, shadowBlur: 17, pickerPreviewMul: 1.12 };
    case "silv_burst":
      return { singleScale: 1, pelletScaleMul: 1.22, shadowBlur: 12, pickerPreviewMul: 0.74 };
    default: {
      const k = shellKindForWeaponId(weaponId);
      const fp = flightProfileHash(weaponId);
      const j = (fp % 997) / 997;
      if (k === "swarm") {
        return {
          singleScale: 0.5 + j * 0.12,
          pelletScaleMul: 1.1 + ((fp >> 3) % 8) * 0.025,
          shadowBlur: 10 + ((fp >> 5) % 7),
          pickerPreviewMul: 0.82 + j * 0.14,
        };
      }
      if (k === "heavy") {
        return {
          singleScale: 1.0 + j * 0.1,
          pelletScaleMul: 1,
          shadowBlur: 17 + ((fp >> 4) % 9),
          pickerPreviewMul: 1.02 + j * 0.1,
        };
      }
      return {
        singleScale: 0.86 + j * 0.14,
        pelletScaleMul: 1,
        shadowBlur: 12 + ((fp >> 6) % 7),
        pickerPreviewMul: 0.94 + j * 0.12,
      };
    }
  }
}

/** Feld-Green: schnelles Kaliber, Rohr-Schwer, Salve — alles eigene Kurven (nicht Navy/Wüste). */
const GREEN_WEAPONS: WeaponDef[] = [
  {
    id: "gr_streak",
    name: "Glade dart",
    nameDe: "Waldhauch",
    packLabel: "tank_bullet1.png",
    dmg: 42,
    splashPx: 47,
    craterPx: 38,
    craterLift: 26,
    velMul: 1.18,
    glow: GLOW_GREEN_A,
    ballisticDragMul: 1.06,
    splashFalloffPow: 2.35,
  },
  {
    id: "gr_bunker",
    name: "Root slam",
    nameDe: "Baumstampfer",
    packLabel: "tank_bullet3.png",
    dmg: 56,
    splashPx: 44,
    craterPx: 70,
    craterLift: 54,
    velMul: 0.9,
    glow: GLOW_GREEN_B,
    ballisticDragMul: 0.85,
  },
  {
    id: "gr_needle",
    name: "Thorn veil",
    nameDe: "Dornenregen",
    packLabel: "tank_bulletFly3.png",
    dmg: 7,
    splashPx: 20,
    craterPx: 8,
    craterLift: 5,
    velMul: 1.09,
    glow: GLOW_GREEN_C,
    pelletBurst: { count: 12, spreadHalfDeg: 7.5 },
    ballisticDragMul: 1.09,
  },
];

const NAVY_WEAPONS: WeaponDef[] = [
  {
    id: "nav_g",
    name: "Brander shell",
    nameDe: "Brander",
    packLabel: "tank_bullet1.png",
    dmg: 48,
    splashPx: 68,
    craterPx: 46,
    craterLift: 34,
    velMul: 1.0,
    glow: GLOW_NAVY,
    ballisticDragMul: 0.98,
    splashFalloffPow: 1.85,
  },
  {
    id: "nav_h",
    name: "Broadside",
    nameDe: "Breitseite",
    packLabel: "tank_bullet3.png",
    dmg: 72,
    splashPx: 50,
    craterPx: 80,
    craterLift: 62,
    velMul: 0.88,
    glow: GLOW_NAVY,
    ballisticDragMul: 0.84,
  },
  {
    id: "nav_s",
    name: "Depth chase",
    nameDe: "Taucherjagd",
    packLabel: "tank_bulletFly3.png",
    dmg: 5,
    splashPx: 30,
    craterPx: 14,
    craterLift: 9,
    velMul: 1.1,
    glow: GLOW_NAVY,
    pelletBurst: { count: 12, spreadHalfDeg: 5.2 },
    ballisticDragMul: 1.04,
  },
];

const DESERT_WEAPONS: WeaponDef[] = [
  {
    id: "des_g",
    name: "Sunburn HE",
    nameDe: "Sonnenbrand-HE",
    packLabel: "tank_bullet1.png",
    dmg: 54,
    splashPx: 72,
    craterPx: 50,
    craterLift: 38,
    velMul: 0.99,
    glow: GLOW_DESERT,
    ballisticDragMul: 0.97,
    splashFalloffPow: 2.05,
  },
  {
    id: "des_h",
    name: "Sierra bore",
    nameDe: "Sierrabohrer",
    packLabel: "tank_bullet3.png",
    dmg: 80,
    splashPx: 52,
    craterPx: 88,
    craterLift: 68,
    velMul: 0.89,
    glow: GLOW_DESERT,
    ballisticDragMul: 0.82,
  },
  {
    id: "des_s",
    name: "Dust devil",
    nameDe: "Staubteufel",
    packLabel: "tank_bulletFly3.png",
    dmg: 9,
    splashPx: 38,
    craterPx: 17,
    craterLift: 12,
    velMul: 1.04,
    glow: GLOW_DESERT,
    pelletBurst: { count: 11, spreadHalfDeg: 16 },
    ballisticDragMul: 1.03,
  },
];

const CRIMSON_WEAPONS: WeaponDef[] = [
  {
    id: "cr_he",
    name: "Keil strike",
    nameDe: "Klingen-HE",
    packLabel: "tank_bullet1.png",
    dmg: 62,
    splashPx: 54,
    craterPx: 50,
    craterLift: 36,
    velMul: 1.14,
    glow: GLOW_CRIMSON,
    ballisticDragMul: 0.95,
    splashFalloffPow: 2.5,
  },
  {
    id: "cr_breaker",
    name: "Lava pit",
    nameDe: "Lavagrube",
    packLabel: "tank_bullet3.png",
    dmg: 88,
    splashPx: 48,
    craterPx: 94,
    craterLift: 72,
    velMul: 0.86,
    glow: GLOW_CRIMSON,
    ballisticDragMul: 0.78,
  },
  {
    id: "cr_sparks",
    name: "Ember fan",
    nameDe: "Glutfächer",
    packLabel: "tank_bulletFly3.png",
    dmg: 8,
    splashPx: 26,
    craterPx: 13,
    craterLift: 8,
    velMul: 1.12,
    glow: GLOW_CRIMSON,
    pelletBurst: { count: 9, spreadHalfDeg: 12.5 },
    ballisticDragMul: 1.01,
  },
];

const BUNKER_WEAPONS: WeaponDef[] = [
  {
    id: "bnk_void_breach",
    name: "Void breach HE",
    nameDe: "Void-Bresche",
    packLabel: "tank_bullet1.png",
    dmg: 108,
    splashPx: 92,
    craterPx: 72,
    craterLift: 52,
    velMul: 1.08,
    glow: GLOW_BUNKER_MYTHIC,
    ballisticDragMul: 0.86,
    splashFalloffPow: 1.55,
  },
  {
    id: "bnk_fusion_core",
    name: "Fusion bore",
    nameDe: "Fusionskern",
    packLabel: "tank_bullet3.png",
    dmg: 158,
    splashPx: 68,
    craterPx: 128,
    craterLift: 96,
    velMul: 0.98,
    glow: GLOW_BUNKER_MYTHIC,
    ballisticDragMul: 0.64,
    splashFalloffPow: 2.1,
  },
  {
    id: "bnk_shard_tempest",
    name: "Shard tempest",
    nameDe: "Splitterorkan",
    packLabel: "tank_bulletFly3.png",
    dmg: 11,
    splashPx: 34,
    craterPx: 18,
    craterLift: 11,
    velMul: 1.12,
    glow: GLOW_BUNKER_MYTHIC,
    pelletBurst: { count: 28, spreadHalfDeg: 8.4 },
    ballisticDragMul: 0.98,
  },
  {
    id: "bnk_siege_laser",
    name: "Siege laser beam",
    nameDe: "Siegelaser",
    packLabel: "tank_bullet3.png",
    dmg: 22,
    splashPx: 58,
    craterPx: 42,
    craterLift: 32,
    velMul: 1,
    glow: GLOW_BUNKER_MYTHIC,
    ballisticDragMul: 1,
    siegeLaser: true,
  },
];

const VIPER_WEAPONS: WeaponDef[] = [
  {
    id: "vip_lance",
    name: "Strike fang",
    nameDe: "Schlangenstoß",
    packLabel: "tank_bullet1.png",
    dmg: 72,
    splashPx: 50,
    craterPx: 42,
    craterLift: 28,
    velMul: 1.22,
    glow: GLOW_VIPER,
    ballisticDragMul: 0.96,
    splashFalloffPow: 2.65,
  },
  {
    id: "vip_fang",
    name: "Fang bore",
    nameDe: "Reißzahn",
    packLabel: "tank_bullet3.png",
    dmg: 100,
    splashPx: 50,
    craterPx: 96,
    craterLift: 74,
    velMul: 0.86,
    glow: GLOW_VIPER,
    ballisticDragMul: 0.73,
  },
  {
    id: "vip_swarm",
    name: "Acid mist",
    nameDe: "Nebelgift",
    packLabel: "tank_bulletFly3.png",
    dmg: 10,
    splashPx: 32,
    craterPx: 12,
    craterLift: 7,
    velMul: 1.14,
    glow: GLOW_VIPER,
    pelletBurst: { count: 18, spreadHalfDeg: 9.5 },
    ballisticDragMul: 1.0,
  },
];

/** Viper-Spezial bei vollem Locker (auch in {@link LOCKER_MAX_SPECIAL_WEAPONS}). */
export const VIPER_GIFT_BOMB_WEAPON: WeaponDef = {
  id: "viper_gift_bomb",
  name: "Poison bomb",
  nameDe: "Giftbombe",
  packLabel: "tank_bullet3.png",
  dmg: 58,
  splashPx: 78,
  craterPx: 52,
  craterLift: 42,
  velMul: 0.93,
  glow: GLOW_VIPER_POISON,
  ballisticDragMul: 0.9,
};

/** Vierte Waffe pro Panzer, wenn alle Locker-Äste auf Max (Spiel: Taste 6). */
const LOCKER_MAX_SPECIAL_WEAPONS: Record<PlayerTankId, WeaponDef> = {
  silver: {
    id: "silv_lock_special",
    name: "Constellation volley",
    nameDe: "Konstellation",
    packLabel: "tank_bullet3.png",
    dmg: 52,
    splashPx: 90,
    craterPx: 40,
    craterLift: 32,
    velMul: 0.98,
    glow: GLOW_SILVER,
    ballisticDragMul: 0.94,
    splashFalloffPow: 1.55,
  },
  green: {
    id: "grn_lock_special",
    name: "Thicket lock",
    nameDe: "Dickichtsperre",
    packLabel: "tank_bullet3.png",
    dmg: 58,
    splashPx: 74,
    craterPx: 58,
    craterLift: 46,
    velMul: 0.92,
    glow: GLOW_GREEN_B,
    ballisticDragMul: 0.88,
  },
  navy: {
    id: "nvy_lock_special",
    name: "Hull shock",
    nameDe: "Schiffsbeben",
    packLabel: "tank_bullet3.png",
    dmg: 60,
    splashPx: 86,
    craterPx: 54,
    craterLift: 44,
    velMul: 0.9,
    glow: GLOW_NAVY,
    ballisticDragMul: 0.87,
    splashFalloffPow: 1.7,
  },
  desert: {
    id: "dst_lock_special",
    name: "Heat wave",
    nameDe: "Hitzewelle",
    packLabel: "tank_bullet3.png",
    dmg: 56,
    splashPx: 88,
    craterPx: 56,
    craterLift: 46,
    velMul: 0.91,
    glow: GLOW_DESERT,
    ballisticDragMul: 0.88,
    splashFalloffPow: 1.9,
  },
  crimson: {
    id: "crm_lock_special",
    name: "Flame wall",
    nameDe: "Flammenwand",
    packLabel: "tank_bullet3.png",
    dmg: 68,
    splashPx: 70,
    craterPx: 62,
    craterLift: 50,
    velMul: 0.9,
    glow: GLOW_CRIMSON,
    ballisticDragMul: 0.86,
    splashFalloffPow: 2.35,
  },
  bunker: {
    id: "bnk_lock_special",
    name: "Starfall ram",
    nameDe: "Sternenfall",
    packLabel: "tank_bullet3.png",
    dmg: 128,
    splashPx: 96,
    craterPx: 142,
    craterLift: 108,
    velMul: 1.02,
    glow: GLOW_BUNKER_MYTHIC,
    ballisticDragMul: 0.58,
    splashFalloffPow: 2.05,
  },
  viper: VIPER_GIFT_BOMB_WEAPON,
};

/** `true`, wenn Treibstoff-, Schadens- und Kraft-Ast je auf {@link LOCKER_UPGRADE_MAX_LEVEL}. */
export function lockerMaxSpecialAttackUnlocked(levels: Record<LockerUpgradeBranchId, number>): boolean {
  return (
    levels.fuel >= LOCKER_UPGRADE_MAX_LEVEL &&
    levels.damage >= LOCKER_UPGRADE_MAX_LEVEL &&
    levels.power >= LOCKER_UPGRADE_MAX_LEVEL
  );
}

/** Spezialwaffe für diesen Panzer (immer definiert; im Spiel nur angehängt wenn {@link lockerMaxSpecialAttackUnlocked}). */
export function lockerMaxBonusWeaponFor(tankId: PlayerTankId): WeaponDef {
  return LOCKER_MAX_SPECIAL_WEAPONS[tankId]!;
}

/** Max. LP des Gegner-Panzers pro Runde, wenn der Bunker-Titan ausgerüstet ist (Spieler 500, Bot nicht). */
export const BUNKER_MATCH_BOT_MAX_HP = 165;

export const PLAYER_TANKS: readonly PlayerTankDef[] = [
  {
    id: "silver",
    nameDe: "Silber-Chassis",
    subtitleDe:
      "Starter — Lehrgranate mit Druckwelle · Chassis-HE · Splitterhagel (18×6). Voller Locker: Spezial Konstellation (Taste 6).",
    priceGems: 0,
    atlasSprite: "tankGrey",
    maxHp: 118,
    weapons: SILVER_WEAPONS,
    blitzMul: 0.85,
  },
  {
    id: "green",
    nameDe: "Feld-Green",
    subtitleDe:
      "Waldgrün · Waldhauch (schnell, zielgenau) · Baumstampfer (tiefe Krater) · Dornenregen (12 Splitter). Voller Locker: Dickichtsperre (Taste 6).",
    priceGems: GEM_PRICE_TANK_GREEN,
    atlasSprite: "tankPlayerGreen",
    maxHp: 124,
    weapons: GREEN_WEAPONS,
    blitzMul: 1,
  },
  {
    id: "navy",
    nameDe: "Marine",
    subtitleDe:
      "Marine · Brander (Fläche) · Breitseite (Rumpfknacker) · Taucherjagd (12 enge Seekügel). Voller Locker: Schiffsbeben (Taste 6).",
    priceGems: GEM_PRICE_TANK_NAVY,
    atlasSprite: "tankNavy",
    maxHp: 130,
    weapons: NAVY_WEAPONS,
    blitzMul: 1.08,
  },
  {
    id: "desert",
    nameDe: "Wüsten-Speer",
    subtitleDe:
      "Sonnenbrand-HE (Hitzefalloff) · Sierrabohrer · Staubteufel (11 breite Splitter). Voller Locker: Hitzewelle (Taste 6).",
    priceGems: GEM_PRICE_TANK_DESERT,
    atlasSprite: "tankDesert",
    maxHp: 136,
    weapons: DESERT_WEAPONS,
    blitzMul: 1.14,
  },
  {
    id: "crimson",
    nameDe: "Roter Keil",
    subtitleDe:
      "Sturm-Keil · Klingen-HE (schmale Wucht) · Lavagrube · Glutfächer. Voller Locker: Flammenwand (Taste 6).",
    priceGems: GEM_PRICE_TANK_CRIMSON,
    atlasSprite: "tankCrimson",
    customSprite: "redStriker",
    maxHp: 142,
    weapons: CRIMSON_WEAPONS,
    blitzMul: 1.2,
  },
  {
    id: "bunker",
    nameDe: "Bunker-Titan",
    subtitleDe:
      `Ultra-Kategorie (10 000 💎) · 500 LP (Gegner max. ${BUNKER_MATCH_BOT_MAX_HP} LP) · Vier Waffen inkl. violetter Siegelaser (5 s, 1×/Runde, Taste 8 oder Waffe wählen + Feuer). Voller Locker: Sternenfall (Taste 6).`,
    priceGems: GEM_PRICE_TANK_BUNKER,
    atlasSprite: "tankBunker",
    customSprite: "bunkerShield",
    maxHp: 500,
    weapons: BUNKER_WEAPONS,
    blitzMul: 1.55,
  },
  {
    id: "viper",
    nameDe: "Viper-Green",
    subtitleDe:
      "Endgame · Schlangenstoß · Reißzahn · Nebelgift (18 Splitter). Voller Locker: Giftbombe (Taste 6).",
    priceGems: GEM_PRICE_TANK_VIPER,
    atlasSprite: "tankViper",
    customSprite: "viperEnergy",
    maxHp: 158,
    weapons: VIPER_WEAPONS,
    blitzMul: 1.34,
  },
];

export function getPlayerTankDef(id: PlayerTankId): PlayerTankDef | undefined {
  return PLAYER_TANKS.find((t) => t.id === id);
}

export const TANK_STORAGE_OWNED = "tank-artillery-tanks-owned-v1";
export const TANK_STORAGE_EQUIPPED = "tank-artillery-tank-equipped-v1";

const ALL_TANK_IDS: ReadonlySet<PlayerTankId> = new Set(PLAYER_TANKS.map((t) => t.id));

function parseOwnedTankList(raw: string | null): PlayerTankId[] {
  if (!raw) return ["silver"];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return ["silver"];
    const out = arr.filter((x): x is PlayerTankId => typeof x === "string" && ALL_TANK_IDS.has(x as PlayerTankId));
    if (out.length === 0) return ["silver"];
    if (!out.includes("silver")) out.unshift("silver");
    return out;
  } catch {
    return ["silver"];
  }
}

export function readOwnedTankIds(): PlayerTankId[] {
  try {
    if (typeof localStorage === "undefined") return ["silver"];
    const list = parseOwnedTankList(localStorage.getItem(TANK_STORAGE_OWNED));
    return [...new Set(list)];
  } catch {
    return ["silver"];
  }
}

function persistOwnedTanks(ids: readonly PlayerTankId[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    const uniq = [...new Set(ids)];
    localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(uniq));
  } catch {
    /** ignore */
  }
}

/** Erster Kauf: Silber liegt immer bereit — weitere panzer müssen mit 💎 gekauft werden */
export function addOwnedTank(id: PlayerTankId): void {
  const cur = readOwnedTankIds();
  if (cur.includes(id)) return;
  cur.push(id);
  persistOwnedTanks(cur);
}

export function readEquippedTankId(): PlayerTankId {
  try {
    if (typeof localStorage === "undefined") return "silver";
    const raw = localStorage.getItem(TANK_STORAGE_EQUIPPED);
    const rid = typeof raw === "string" ? raw.trim() : "";
    if (ALL_TANK_IDS.has(rid as PlayerTankId)) {
      const tankId = rid as PlayerTankId;
      const owned = readOwnedTankIds();
      if (owned.includes(tankId)) return tankId;
    }
    return readOwnedTankIds()[0] ?? "silver";
  } catch {
    return "silver";
  }
}

export function setEquippedTankId(id: PlayerTankId): boolean {
  try {
    if (!readOwnedTankIds().includes(id)) return false;
    if (typeof localStorage !== "undefined") localStorage.setItem(TANK_STORAGE_EQUIPPED, id);
    return true;
  } catch {
    return false;
  }
}

/** Aktuell geführtes Fahrzeug inklusive Munition für die drei Slots */
export function getEquippedPlayerTank(): PlayerTankDef {
  const id = readEquippedTankId();
  const t = getPlayerTankDef(id);
  if (t) return t;
  return getPlayerTankDef("silver")!;
}

export function spendGems(cost: number): boolean {
  if (!(cost > 0)) return true;
  if (adminGemsUnlocked()) return true;
  const g = readGems();
  if (g < cost) return false;
  addGems(-cost);
  return true;
}

export type TankPurchaseResult = "ok" | "owned" | "expensive" | "invalid";

export function tryBuyTank(id: PlayerTankId): TankPurchaseResult {
  const def = getPlayerTankDef(id);
  if (!def) return "invalid";
  if (def.priceGems <= 0) return "owned";
  if (readOwnedTankIds().includes(id)) return "owned";
  const g = readGems();
  if (g < def.priceGems) return "expensive";
  if (!spendGems(def.priceGems)) return "expensive";
  addOwnedTank(id);
  void setEquippedTankId(id);
  return "ok";
}

/** Wüsten-Panzer Kristallschild (Shop) — 500 💎, je Aktivierung +80 Absorption diese Runde · pro Kauf 3 Aktivierungen (unabhängig von Blitz/Runden-Rhythmus). */
export const DESERT_SHIELD_PRICE_GEMS = 500;
export const DESERT_SHIELD_ABSORB = 80;
/** Aktivierungen (Taste 5 in erlaubter Runde), danach wieder kaufen. */
export const DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE = 3;
export const DESERT_SHIELD_STORAGE_KEY = "tank-artillery-desert-shield-v1";

/** Aktuelle Ladungen (0 = aufgebraucht, erneuter Shop-Kauf). */
export function readDesertShieldCharges(): number {
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(DESERT_SHIELD_STORAGE_KEY) : null;
    if (raw == null) return 0;
    /** Ältere Speicherung: Flag „besitz“ ohne Zähler — als volles Paket werten. */
    if (raw === "1") return DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE, n));
  } catch {
    return 0;
  }
}

function writeDesertShieldCharges(n: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    const c = Math.max(
      0,
      Math.min(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE, Math.floor(n)),
    );
    localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, String(c));
  } catch {
    /** ignore */
  }
}

export function readDesertShieldOwned(): boolean {
  return readDesertShieldCharges() > 0;
}

/** Nach erfolgreicher Taste-5-Aktivierung im Kampf. */
export function consumeDesertShieldActivation(): void {
  const c = readDesertShieldCharges();
  if (c <= 0) return;
  writeDesertShieldCharges(c - 1);
}

export type DesertShieldPurchaseResult = "ok" | "owned" | "expensive" | "missing_tank";

export function tryBuyDesertShield(): DesertShieldPurchaseResult {
  if (readDesertShieldCharges() > 0) return "owned";
  if (!readOwnedTankIds().includes("desert")) return "missing_tank";
  if (!(readGems() >= DESERT_SHIELD_PRICE_GEMS)) return "expensive";
  if (!spendGems(DESERT_SHIELD_PRICE_GEMS)) return "expensive";
  writeDesertShieldCharges(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE);
  return "ok";
}

/** Shop-Kosmetik: Spur-Effekt in der Fahrphase (← →). Feuer/Blitz nur Optik; Regenbogen mit manuellem Kampf-Start (Taste 7 / Button), siehe main. */
export type PurchasableMoveTrailId = "fire" | "lightning" | "rainbow";
export type MoveTrailCosmeticId = "none" | PurchasableMoveTrailId;

export const MOVE_TRAIL_FIRE_PRICE_GEMS = 85;
export const MOVE_TRAIL_LIGHTNING_PRICE_GEMS = 110;
export const MOVE_TRAIL_RAINBOW_PRICE_GEMS = 2000;
export const MOVE_TRAIL_OWNED_KEY = "tank-artillery-move-trails-owned-v1";
export const MOVE_TRAIL_EQUIPPED_KEY = "tank-artillery-move-trail-equipped-v1";

const PURCHASABLE_TRAIL_IDS: ReadonlySet<PurchasableMoveTrailId> = new Set(["fire", "lightning", "rainbow"]);

function parseOwnedMoveTrails(raw: string | null): PurchasableMoveTrailId[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: PurchasableMoveTrailId[] = [];
    for (const x of arr) {
      if (x === "fire" || x === "lightning" || x === "rainbow") out.push(x);
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

export function readOwnedMoveTrailIds(): PurchasableMoveTrailId[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return parseOwnedMoveTrails(localStorage.getItem(MOVE_TRAIL_OWNED_KEY));
  } catch {
    return [];
  }
}

function persistOwnedMoveTrails(ids: readonly PurchasableMoveTrailId[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(MOVE_TRAIL_OWNED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /** ignore */
  }
}

function addOwnedMoveTrail(id: PurchasableMoveTrailId): void {
  const cur = readOwnedMoveTrailIds();
  if (cur.includes(id)) return;
  cur.push(id);
  persistOwnedMoveTrails(cur);
}

export function readEquippedMoveTrail(): MoveTrailCosmeticId {
  try {
    if (typeof localStorage === "undefined") return "none";
    const raw = localStorage.getItem(MOVE_TRAIL_EQUIPPED_KEY)?.trim();
    if (raw === "fire" || raw === "lightning" || raw === "rainbow") {
      if (readOwnedMoveTrailIds().includes(raw)) return raw;
    }
    return "none";
  } catch {
    return "none";
  }
}

export function setEquippedMoveTrail(id: MoveTrailCosmeticId): boolean {
  try {
    if (id === "none") {
      if (typeof localStorage !== "undefined") localStorage.setItem(MOVE_TRAIL_EQUIPPED_KEY, "none");
      return true;
    }
    if (!PURCHASABLE_TRAIL_IDS.has(id)) return false;
    if (!readOwnedMoveTrailIds().includes(id)) return false;
    if (typeof localStorage !== "undefined") localStorage.setItem(MOVE_TRAIL_EQUIPPED_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export type MoveTrailPurchaseResult = "ok" | "owned" | "expensive" | "invalid";

export function tryBuyMoveTrailCosmetic(id: PurchasableMoveTrailId): MoveTrailPurchaseResult {
  if (!PURCHASABLE_TRAIL_IDS.has(id)) return "invalid";
  if (readOwnedMoveTrailIds().includes(id)) return "owned";
  const price =
    id === "fire"
      ? MOVE_TRAIL_FIRE_PRICE_GEMS
      : id === "lightning"
        ? MOVE_TRAIL_LIGHTNING_PRICE_GEMS
        : MOVE_TRAIL_RAINBOW_PRICE_GEMS;
  if (readGems() < price) return "expensive";
  if (!spendGems(price)) return "expensive";
  addOwnedMoveTrail(id);
  void setEquippedMoveTrail(id);
  return "ok";
}

/** Locker: permanente 💎-Upgrades **pro Panzer** (Stufe 1…10 pro Ast; Kauf gilt für den ausgerüsteten Panzer). */
export const LOCKER_UPGRADE_MAX_LEVEL = 10;
export const LOCKER_UPGRADES_STORAGE_KEY = "tank-artillery-locker-upgrades-v1";

export type LockerUpgradeBranchId = "fuel" | "damage" | "power";

const LOCKER_UPGRADE_BRANCH_IDS: ReadonlySet<LockerUpgradeBranchId> = new Set(["fuel", "damage", "power"]);

const LOCKER_UPGRADE_COST_GROWTH = 1.52;

export const LOCKER_UPGRADE_META: Record<
  LockerUpgradeBranchId,
  { titleDe: string; subtitleDe: string; baseCost: number }
> = {
  fuel: {
    titleDe: "Treibstoff-Tank",
    subtitleDe: "Mehr Treibstoff pro Runde fürs Fahren (← →).",
    baseCost: 28,
  },
  damage: {
    titleDe: "Kaliber",
    subtitleDe: "Stärkere Treffer gegen den Gegner (Granaten, Streu, Blitz, Spezial).",
    baseCost: 40,
  },
  power: {
    titleDe: "Kraft-Regler",
    subtitleDe: "Höheres Kraft-Maximum beim Zielen (W/S).",
    baseCost: 34,
  },
};

function clampLockerUpgradeLevel(n: unknown): number {
  const k = Math.floor(Number(n));
  if (!Number.isFinite(k)) return 0;
  return Math.max(0, Math.min(LOCKER_UPGRADE_MAX_LEVEL, k));
}

const LOCKER_ZERO: Record<LockerUpgradeBranchId, number> = { fuel: 0, damage: 0, power: 0 };

function emptyLockerMap(): Record<PlayerTankId, Record<LockerUpgradeBranchId, number>> {
  const out = {} as Record<PlayerTankId, Record<LockerUpgradeBranchId, number>>;
  for (const t of PLAYER_TANKS) {
    out[t.id] = { ...LOCKER_ZERO };
  }
  return out;
}

function mergeTankLevelsFromJson(
  out: Record<PlayerTankId, Record<LockerUpgradeBranchId, number>>,
  tankId: PlayerTankId,
  src: unknown,
): void {
  if (!src || typeof src !== "object" || Array.isArray(src)) return;
  const tr = src as Record<string, unknown>;
  out[tankId] = {
    fuel: clampLockerUpgradeLevel(tr.fuel),
    damage: clampLockerUpgradeLevel(tr.damage),
    power: clampLockerUpgradeLevel(tr.power),
  };
}

function looksLikePerTankLockerJson(o: Record<string, unknown>): boolean {
  for (const tid of ALL_TANK_IDS) {
    const v = o[tid];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const tr = v as Record<string, unknown>;
      if ("fuel" in tr || "damage" in tr || "power" in tr) return true;
    }
  }
  return false;
}

function persistLockerUpgradeMap(map: Record<PlayerTankId, Record<LockerUpgradeBranchId, number>>): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LOCKER_UPGRADES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /** ignore */
  }
}

/**
 * Alle Locker-Stufen pro Panzer (je Ast 0…10). Alte flache Saves `{ fuel, damage, power }` werden
 * beim ersten Lesen verworfen — jeder Panzer startet dann bei 0.
 */
export function readLockerUpgradeMap(): Record<PlayerTankId, Record<LockerUpgradeBranchId, number>> {
  const defaults = emptyLockerMap();
  try {
    if (typeof localStorage === "undefined") return defaults;
    const raw = localStorage.getItem(LOCKER_UPGRADES_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const o = parsed as Record<string, unknown>;

    if (looksLikePerTankLockerJson(o)) {
      for (const tid of ALL_TANK_IDS) {
        mergeTankLevelsFromJson(defaults, tid, o[tid]);
      }
      return defaults;
    }

    if ("fuel" in o || "damage" in o || "power" in o) {
      persistLockerUpgradeMap(emptyLockerMap());
      return emptyLockerMap();
    }

    return defaults;
  } catch {
    return defaults;
  }
}

export function readLockerUpgradeLevelsFor(tankId: PlayerTankId): Record<LockerUpgradeBranchId, number> {
  const m = readLockerUpgradeMap();
  const row = m[tankId];
  return row ?? { ...LOCKER_ZERO };
}

/** Stufen des **ausgerüsteten** Panzers (Locker-UI, Käufe im Hub). */
export function readLockerUpgradeLevels(): Record<LockerUpgradeBranchId, number> {
  return readLockerUpgradeLevelsFor(readEquippedTankId());
}

/** Kosten für einen Schritt von `currentLevel` → `currentLevel + 1` (`currentLevel` 0…9). */
export function lockerUpgradeStepCostGems(branch: LockerUpgradeBranchId, currentLevel: number): number {
  if (currentLevel < 0 || currentLevel >= LOCKER_UPGRADE_MAX_LEVEL) return 0;
  const base = LOCKER_UPGRADE_META[branch].baseCost;
  return Math.round(base * Math.pow(LOCKER_UPGRADE_COST_GROWTH, currentLevel));
}

/** Additiv zu {@link FUEL_MOVE} bei Stufe `L`. */
export function lockerUpgradeFuelBonus(L: number): number {
  return clampLockerUpgradeLevel(L) * 18;
}

/** Schadens-Faktor des Spielers gegen den Bot. */
export function lockerUpgradeDamageMul(L: number): number {
  return 1 + 0.036 * clampLockerUpgradeLevel(L);
}

/** Additiv zur Kraft-Obergrenze (Basis 1220). */
export function lockerUpgradePowMaxDelta(L: number): number {
  return clampLockerUpgradeLevel(L) * 16;
}

export type LockerUpgradePurchaseResult = "ok" | "expensive" | "max";

export function tryBuyLockerUpgrade(branch: LockerUpgradeBranchId): LockerUpgradePurchaseResult {
  if (!LOCKER_UPGRADE_BRANCH_IDS.has(branch)) return "max";
  const tankId = readEquippedTankId();
  const map = readLockerUpgradeMap();
  const levels = { ...map[tankId]! };
  const cur = levels[branch];
  if (cur >= LOCKER_UPGRADE_MAX_LEVEL) return "max";
  const cost = lockerUpgradeStepCostGems(branch, cur);
  if (!spendGems(cost)) return "expensive";
  levels[branch] = cur + 1;
  map[tankId] = levels;
  persistLockerUpgradeMap(map);
  return "ok";
}

export function getWeapon(ix: number): WeaponDef {
  const w = WEAPONS[((ix % WEAPONS.length) + WEAPONS.length) % WEAPONS.length];
  return w!;
}

/** Krater: Oberfläche nach unten (Y wird größer) */
export function applyCrater(surface: TerrainSurface, cx: number, radius: number, depth: number): void {
  const w = surface.y.length;
  const r2 = radius * radius;
  for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
    if (x < 0 || x >= w) continue;
    const dx = cx - x;
    const bell = Math.max(0, 1 - (dx * dx) / Math.max(r2, 1e-6));
    if (bell <= 0) continue;
    surface.y[x] = Math.min(WORLD.H * 0.93, surface.y[x]! + depth * bell * bell);
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Elevationswinkel relativ zur Lokalseite: links schießt nach rechts, rechts nach links.
 * Winkel positiv zwischen ~12°–86° relativ zur Horizontalen beim linken Rohr.
 */
export function velocityFromElevDeg(isLeft: boolean, angleDeg: number, power: number, velMul: number): Vec2 {
  const r = Math.max(11, Math.min(86, angleDeg)) * (Math.PI / 180);
  const p = Math.max(0, power) * velMul;
  const vx = Math.cos(r) * p * (isLeft ? 1 : -1);
  const vy = -Math.sin(r) * p;
  return { x: vx, y: vy };
}

/** Zufällige leichte Winkelabweichung für Streusalven (links/rechts wie `velocityFromElevDeg`). */
export function jitteredShotVelocity(
  isLeft: boolean,
  angleDeg: number,
  power: number,
  velMul: number,
  spreadHalfDeg: number,
  rnd: () => number,
): Vec2 {
  const jitter = (rnd() * 2 - 1) * Math.max(0, spreadHalfDeg);
  return velocityFromElevDeg(isLeft, angleDeg + jitter, power, velMul);
}

/**
 * Bunker-Titan: fester Mörser-Bogen. Zu steil (z. B. 77°) ⇒ fast keine horizontale Komponente,
 * typische Gegner-Distanz nicht erreichbar — daher moderater Bogen + Extra-Ladung.
 */
export const BUNKER_MORTAR_FIXED_ELEV_DEG = 61;
export const BUNKER_MORTAR_EXTRA_VEL_MUL = 1.22;

/** Bunker-exklusiv: Taste 8 im Kampf, 1× pro Runde — lila Siegelaser auf den Gegner. */
export const BUNKER_LASER_DURATION_MS = 5000;
/** Dauerfeuer (skaliert mit Locker-Schaden vs. Bot). */
export const BUNKER_LASER_DPS = 22;

/** Spieler-Ballistik: jeder Panzer hat ein eigenes Ziel-/Startgesetz (rein deterministisch). */
export type PlayerBallisticMode =
  | "classic_elev_power"
  | "quantized_grid"
  | "naval_flatten"
  | "heat_shear"
  | "overpressure"
  | "siege_mortar"
  | "coil_rail";

export function playerBallisticModeForTank(tankId: PlayerTankId): PlayerBallisticMode {
  switch (tankId) {
    case "silver":
      return "classic_elev_power";
    case "green":
      return "quantized_grid";
    case "navy":
      return "naval_flatten";
    case "desert":
      return "heat_shear";
    case "crimson":
      return "overpressure";
    case "bunker":
      return "siege_mortar";
    case "viper":
      return "coil_rail";
  }
}

/**
 * Sichtbarer Rohrwinkel / Mündung — beim Mörser (`bunker`) folgt das Rohr einem festen hohen Ton,
 * während `aimAngleDeg` die Seitenführung (Eingabe wie beim klassischen Winkel) repräsentiert.
 */
export function playerBarrelDrawDeg(tankId: PlayerTankId, aimAngleDeg: number): number {
  const a = clampNumber(aimAngleDeg, 11, 88);
  if (tankId !== "bunker") return a;
  const lateral = clampNumber((a - 52) * 0.48, -14, 14);
  return clampNumber(BUNKER_MORTAR_FIXED_ELEV_DEG + lateral, 48, 84);
}

export function playerShotVelocityForTank(
  tankId: PlayerTankId,
  isLeft: boolean,
  angleDeg: number,
  power: number,
  velMul: number,
): Vec2 {
  const mode = playerBallisticModeForTank(tankId);
  switch (mode) {
    case "classic_elev_power":
      return velocityFromElevDeg(isLeft, angleDeg, power, velMul);
    case "quantized_grid": {
      const q = Math.round(angleDeg * 2) / 2;
      return velocityFromElevDeg(isLeft, clampNumber(q, 18, 86), power, velMul);
    }
    case "naval_flatten": {
      const t = clampNumber((power - 380) / 460, 0, 1);
      const flatBias = t * 10;
      const a = angleDeg - flatBias * 0.35;
      return velocityFromElevDeg(isLeft, a, power, velMul * 1.02);
    }
    case "heat_shear": {
      const v = velocityFromElevDeg(isLeft, angleDeg, power, velMul);
      return { x: v.x * 1.06, y: v.y * 0.96 };
    }
    case "overpressure": {
      const v = velocityFromElevDeg(isLeft, angleDeg, power, velMul);
      const magBoost = 1 + Math.min(0.12, Math.max(0, (power - 380) / 5000));
      return { x: v.x * magBoost, y: v.y * magBoost };
    }
    case "siege_mortar": {
      const elev = BUNKER_MORTAR_FIXED_ELEV_DEG;
      const v0 = velocityFromElevDeg(isLeft, elev, power, velMul * BUNKER_MORTAR_EXTRA_VEL_MUL);
      const lateralTurn = clampNumber((angleDeg - 52) / 34, -1, 1) * ((14 * Math.PI) / 180);
      const c = Math.cos(lateralTurn);
      const s = Math.sin(lateralTurn);
      return { x: v0.x * c - v0.y * s, y: v0.x * s + v0.y * c };
    }
    case "coil_rail": {
      const v = velocityFromElevDeg(isLeft, angleDeg, power, velMul * 1.05);
      return { x: v.x * 1.04, y: v.y * 0.98 };
    }
  }
}

export function jitteredPlayerShotVelocity(
  tankId: PlayerTankId,
  isLeft: boolean,
  angleDeg: number,
  power: number,
  velMul: number,
  spreadHalfDeg: number,
  rnd: () => number,
): Vec2 {
  const jitter = (rnd() * 2 - 1) * Math.max(0, spreadHalfDeg);
  return playerShotVelocityForTank(tankId, isLeft, angleDeg + jitter, power, velMul);
}

export interface ImpactResult {
  x: number;
  y: number;
}

export const TANK_HALF_W = 22;
export const TANK_HALF_H = 17;

/**
 * AABB für Flug-Simulation (Treffer bevor die Bogen-Integration „durch“ den Panzer bis zum Boden dahinter läuft).
 * Etwas großzügiger als {@link TANK_HALF_W} / Sprite, damit Randtreffer nicht verloren gehen.
 */
export const TANK_IMPACT_HALF_W = 46;
export const TANK_IMPACT_HULL_HEIGHT = 78;

/** Gegnerische Hülle für {@link simulateUntilImpact} / {@link sampleTrajectory} (nur eine Seite pro Schuss). */
export type ImpactHullTarget = {
  cx: number;
  /** Unterkante der Hülle (wie `hullGroundY` im Spiel) */
  baseY: number;
};

function segmentImpactWithTankHull(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  tnk: ImpactHullTarget,
): ImpactResult | null {
  const L = tnk.cx - TANK_IMPACT_HALF_W;
  const R = tnk.cx + TANK_IMPACT_HALF_W;
  const T = tnk.baseY - TANK_IMPACT_HULL_HEIGHT;
  const B = tnk.baseY + 2;
  const dx = bx - ax;
  const dy = by - ay;
  let tEnter = 0;
  let tExit = 1;

  const clipSlab = (c: number, d: number, pMin: number, pMax: number): boolean => {
    if (Math.abs(d) < 1e-9) {
      return c >= pMin && c <= pMax;
    }
    let u0 = (pMin - c) / d;
    let u1 = (pMax - c) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    tEnter = Math.max(tEnter, u0);
    tExit = Math.min(tExit, u1);
    return tEnter <= tExit;
  };

  if (!clipSlab(ax, dx, L, R)) return null;
  if (!clipSlab(ay, dy, T, B)) return null;
  if (tEnter > tExit) return null;
  const lo = Math.max(0, tEnter);
  const hi = Math.min(1, tExit);
  if (lo > hi) return null;
  return { x: ax + dx * lo, y: ay + dy * lo };
}

export type SimulateUntilImpactOpts = {
  /** Panzer-Hülle des Ziels — Schritt wird vor Boden-Treffer geprüft, damit keine „Durchschüsse“ entstehen. */
  hull?: ImpactHullTarget | null;
};

export function simulateUntilImpact(
  surface: TerrainSurface,
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  windAccel: number,
  dt = 1 / 220,
  dragMul = 1,
  opts?: SimulateUntilImpactOpts | null,
): ImpactResult {
  let x = x0;
  let y = y0;
  let vxv = vx;
  let vyv = vy;
  const hull = opts?.hull ?? null;

  const w = surface.y.length;
  const g = WORLD.G;
  const maxSteps = 220_000;

  for (let s = 0; s < maxSteps; s++) {
    const ox = x;
    const oy = y;
    vxv += windAccelAtStep(windAccel, s, x0, y0) * dt;
    vyv += g * dt;
    ({ vx: vxv, vy: vyv } = applyQuadraticAirDrag(vxv, vyv, dt, dragMul));
    x += vxv * dt;
    y += vyv * dt;
    if (hull) {
      const hi = segmentImpactWithTankHull(ox, oy, x, y, hull);
      if (hi) return hi;
    }
    const ground = heightAt(surface, x);

    if (y >= ground - 0.18) return { x, y: ground };

    if (y > WORLD.H + 120 || y < -500) {
      break;
    }
    if (x < -520 || x > w + 520) break;
  }
  return {
    x: Math.max(-8, Math.min(w + 8, x)),
    y: Math.min(heightAt(surface, Math.max(0, Math.min(w - 1, x))), WORLD.H),
  };
}

/** Vorschau-Schweif — nur erste ~maxPts Punkte bis Boden oder Rand */
export function sampleTrajectory(
  surface: TerrainSurface,
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  windAccel: number,
  maxPts = 200,
  dt = 1 / 150,
  dragMul = 1,
  opts?: SimulateUntilImpactOpts | null,
): Vec2[] {
  const pts: Vec2[] = [];
  let x = x0;
  let y = y0;
  let vxW = vx;
  let vz = vy;
  const hull = opts?.hull ?? null;

  const w = surface.y.length;
  const g = WORLD.G;
  for (let i = 0; i < maxPts; i++) {
    const ox = x;
    const oy = y;
    vxW += windAccelAtStep(windAccel, i, x0, y0) * dt;
    vz += g * dt;
    ({ vx: vxW, vy: vz } = applyQuadraticAirDrag(vxW, vz, dt, dragMul));
    x += vxW * dt;
    y += vz * dt;
    if (hull) {
      const hi = segmentImpactWithTankHull(ox, oy, x, y, hull);
      if (hi) {
        pts.push(hi);
        break;
      }
    }
    pts.push({ x, y });
    const gd = heightAt(surface, x);
    if (y >= gd || x < -20 || x > w + 20) {
      pts.push({ x, y: Math.min(y, gd) });
      break;
    }
  }
  return pts;
}

/** Abstand von (px,py) zur Außenkante eines AABB (0, wenn innerhalb oder auf dem Rand). */
function distancePointToAabbExterior(px: number, py: number, L: number, T: number, R: number, B: number): number {
  const dx = px < L ? L - px : px > R ? px - R : 0;
  const dy = py < T ? T - py : py > B ? py - B : 0;
  return Math.hypot(dx, dy);
}

/**
 * Splash-Schaden: Abstand der Explosion zur **gleichen** Hülle wie {@link segmentImpactWithTankHull}
 * (nicht mehr nur Kreis um Sprite-Mitte) — sonst Rand-/Decktreffer oft 0 Schaden trotz Treffer.
 *
 * Optional `directFlat`: innerhalb des Radius `directFlat` plus Falloff aus (`dmgMax` − `directFlat`).
 */
export function splashDamage(
  ex: number,
  ey: number,
  enemyX: number,
  enemyYBase: number,
  _enemyHalfW: number,
  _enemyHalfH: number,
  splashR: number,
  dmgMax: number,
  falloffPow?: number,
  directFlat?: number,
): number {
  const L = enemyX - TANK_IMPACT_HALF_W;
  const R = enemyX + TANK_IMPACT_HALF_W;
  const T = enemyYBase - TANK_IMPACT_HULL_HEIGHT;
  const B = enemyYBase + 2;
  const d = distancePointToAabbExterior(ex, ey, L, T, R, B);
  if (d >= splashR) return 0;
  const t = Math.max(0, 1 - d / splashR);
  const p =
    falloffPow != null && Number.isFinite(falloffPow) && falloffPow > 0 ? falloffPow : 1;
  const dir =
    directFlat != null && Number.isFinite(directFlat) && directFlat > 0
      ? Math.min(directFlat, dmgMax)
      : 0;
  const splashMax = Math.max(0, dmgMax - dir);
  return dir + splashMax * Math.pow(t, p);
}

/** Blitz-Schaden maximal am Zielzentrum — einmalige Spezial-Waffe · stärker als jede Granate */
export const LIGHTNING_DAMAGE = 110;
/** Splash-Radius Welten-Pixel (mit {@link LIGHTNING_DAMAGE} für Randtreffer-Spürbarkeit) */
export const LIGHTNING_SPLASH_PX = 158;
/** Krater-Radius in px (Bell-Kurve auf surface.y) — „großer“ Loch */
export const LIGHTNING_CRATER_PX = 246;
/** Wie stark der Boden absackt — große Zerstörung */
export const LIGHTNING_CRATER_DEPTH = 170;

/** Start-LP ohne Panzerwahl (Bots in Tests); echtes Match → {@link PlayerTankDef.maxHp} */
export const DEFAULT_HP = 118;

/** Max. LP des Bot-Panzers zu Beginn der Runde (Bunker: asymmetrisch, sonst wie Spieler). */
export function enemyMaxHpForPlayerTank(playerTankId: PlayerTankId, playerTankMaxHp: number): number {
  if (playerTankId === "bunker") return BUNKER_MATCH_BOT_MAX_HP;
  return playerTankMaxHp;
}
export const FUEL_MOVE = 210;
export const XP_STORAGE_KEY = "tank-artillery-xp";
/** Sieg-XP bei Map-Schwierigkeit „Normal“ — andere Stufen: {@link xpWinForMapDifficulty}. */
export const XP_WIN = 36;
export const GEM_STORAGE_KEY = "tank-artillery-gems";
/** Nach erfolgreicher Phrase gesetzt → praktisch unbegrenzte 💎 nur in diesem Browser. */
export const ADMIN_GEMS_UNLOCK_STORAGE_KEY = "tank-artillery-admin-gems-unlock-v1";

const ADMIN_EFFECTIVE_GEM_BALANCE = Number.MAX_SAFE_INTEGER;

/** Bei Sieg auf „Normal“: zufällig inklusive [GEM_WIN_MIN, GEM_WIN_MAX] — andere Stufen: {@link gemWinRangeForMapDifficulty}. */
export const GEM_WIN_MIN = 50;
export const GEM_WIN_MAX = 120;

/** Sieg-XP pro Map-Schwierigkeit (leicht am wenigsten, insane am meisten). */
export function xpWinForMapDifficulty(difficulty: TerrainDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 22;
    case "normal":
      return XP_WIN;
    case "hard":
      return 48;
    case "insane":
      return 68;
  }
}

/** Sieg-Gems-Spanne pro Map-Schwierigkeit (Erwartungswert steigt mit dem Level). */
export function gemWinRangeForMapDifficulty(difficulty: TerrainDifficulty): { min: number; max: number } {
  switch (difficulty) {
    case "easy":
      return { min: 36, max: 78 };
    case "normal":
      return { min: GEM_WIN_MIN, max: GEM_WIN_MAX };
    case "hard":
      return { min: 58, max: 132 };
    case "insane":
      return { min: 72, max: 158 };
  }
}

/**
 * Sieg-Gems je nach Map-Schwierigkeit (gleichverteilt in der jeweiligen Spanne).
 * `random01` liefert Werte aus [0, 1).
 */
export function rollGemsForMapDifficulty(random01: () => number, difficulty: TerrainDifficulty): number {
  const { min, max } = gemWinRangeForMapDifficulty(difficulty);
  const span = max - min + 1;
  const u = random01();
  const clamped = Math.min(0.999_999_999_999_999_9, Math.max(0, u));
  return min + Math.floor(clamped * span);
}

/**
 * Sieg-Gems auf [GEM_WIN_MIN, GEM_WIN_MAX] — entspricht {@link rollGemsForMapDifficulty} mit „normal“.
 * `random01` liefert Werte aus [0, 1).
 */
export function rollGemsForWin(random01: () => number): number {
  return rollGemsForMapDifficulty(random01, "normal");
}

export function readGems(): number {
  if (adminGemsUnlocked()) return ADMIN_EFFECTIVE_GEM_BALANCE;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(GEM_STORAGE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addGems(d: number): number {
  if (adminGemsUnlocked()) return ADMIN_EFFECTIVE_GEM_BALANCE;
  const n = Math.max(0, readGems() + d);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(GEM_STORAGE_KEY, String(n));
  } catch {
    /** ignore */
  }
  return n;
}

/** Einmal pro Code & Browser; weltweit nur {@link PROMO_GLOBAL_MAX_SLOTS} erfolgreiche Einlösungen (Server-Zähler) */
export const PROMO_USED_STORAGE_KEY = "tank-artillery-promos-used-v1";

/** Max. erfolgreiche Promo-Einlösungen weltweit (`promo-slot-stub`, Cloudflare Worker, …) */
export const PROMO_GLOBAL_MAX_SLOTS = 3;

/** Belohnung pro gültigem Code (alle gleich) */
export const PROMO_GEMS_PER_CODE = 600;

/** Dev: `games/tank-artillery/promo-slot-stub.mjs` (Port 5799) */
export const PROMO_STUB_DEV_CLAIM_URL = "http://127.0.0.1:5799/claim";

/** Dev: nur auf Loopback — nicht auf gh-pages oder anderen Hosts gültig. */
const LOCAL_ONLY_PROMO_CODE = "seba1";
const LOCAL_ONLY_PROMO_GEMS = 10_000;
const LOCAL_ONLY_XP_CODE = "sebaxp";
const LOCAL_ONLY_XP_AMOUNT = 10_000;
/** Nur Loopback: 1M 💎 + 1M XP in einem Code (Shop → Code, ohne Stub). */
const LOCAL_ONLY_COMBO_CODE = "seba";
const LOCAL_ONLY_COMBO_GEMS = 1_000_000;
const LOCAL_ONLY_COMBO_XP = 1_000_000;
/** Nur Loopback: große 💎-Menge fürs lokale Testen (Shop → Code, ohne Stub). */
const LOCAL_ONLY_MEGA_GEMS_CODE = "admins";
const LOCAL_ONLY_MEGA_GEMS = 1_000_000;

const PROMO_GEMS: Record<string, number> = {
  admin1: PROMO_GEMS_PER_CODE,
  admin2: PROMO_GEMS_PER_CODE,
  admin3: PROMO_GEMS_PER_CODE,
};

/** `true`, wenn die Seite von diesem Rechner läuft (localhost / 127.0.0.1 / ::1). */
export function isLocalTankArtilleryPromoHost(): boolean {
  try {
    const loc = (globalThis as { location?: { hostname?: string } }).location;
    const h = loc?.hostname?.toLowerCase();
    if (!h) return false;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

/** Nur lokale Dev-Codes (seba, seba1, sebaxp, admins): Einlösung ohne `/claim` — kein promo-stub nötig. */
export function promoSkipsGlobalSlotReserve(normalizedKey: string): boolean {
  return (
    isLocalTankArtilleryPromoHost() &&
    (normalizedKey === LOCAL_ONLY_COMBO_CODE ||
      normalizedKey === LOCAL_ONLY_PROMO_CODE ||
      normalizedKey === LOCAL_ONLY_XP_CODE ||
      normalizedKey === LOCAL_ONLY_MEGA_GEMS_CODE)
  );
}

export type PromoReserveResult = "ok" | "full" | "bad_response" | "network_error";

function stripEnv(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Build: `VITE_ADMIN_GEM_PASSPHRASE` oder Laufzeit `window.__TANK_ADMIN_GEM_PASSPHRASE__`. Ohne Eintrag keine Admin-Funktion (Standard). */
function adminGemPassphraseConfigured(): string | null {
  if (typeof globalThis !== "undefined" && "window" in globalThis && globalThis.window != null) {
    const win = stripEnv(globalThis.window.__TANK_ADMIN_GEM_PASSPHRASE__);
    if (win) return win;
  }
  return stripEnv(typeof import.meta !== "undefined" ? import.meta.env?.VITE_ADMIN_GEM_PASSPHRASE : undefined);
}

export function adminGemsUnlocked(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" && localStorage.getItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Vergleicht mit Gastgeber-Phrase nur wenn du sie per Build oder `window` (nicht öffentlich) einfügst —
 * keine echte Zuordnung zur Person ohne Server möglich.
 */
export function unlockAdminGems(passphrase: string): boolean {
  const secret = adminGemPassphraseConfigured();
  if (!secret) return false;
  if (passphrase.trim() !== secret) return false;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    /** Laufzeit-Override ohne neuen Build (z. B. eigenes Hosting-Script vor `main.ts`). */
    __TANK_PROMO_CLAIM_URL__?: string;
    /** Optional: eigene Unlock-Phrase statt nur Vite-ENV (vor `main.ts` setzen). */
    __TANK_ADMIN_GEM_PASSPHRASE__?: string;
  }
}

/**
 * POST-URL für Slot-Reservierung.
 * - Gehostet: Build mit `VITE_TANK_PROMO_CLAIM_URL` (HTTPS Worker `/claim`). Oder Laufzeit: `window.__TANK_PROMO_CLAIM_URL__` vor Laden von main setzen.
 * - Vite Dev: Fallback {@link PROMO_STUB_DEV_CLAIM_URL} (Stub: `pnpm exec node games/tank-artillery/promo-slot-stub.mjs`).
 */
export function promoClaimEndpoint(): string | null {
  if (typeof globalThis !== "undefined" && "window" in globalThis && globalThis.window != null) {
    const injected = stripEnv(globalThis.window.__TANK_PROMO_CLAIM_URL__);
    if (injected) return injected;
  }
  const custom = stripEnv(typeof import.meta !== "undefined" ? import.meta.env?.VITE_TANK_PROMO_CLAIM_URL : undefined);
  if (custom) return custom;
  if (typeof import.meta !== "undefined" && import.meta.env.DEV) {
    return PROMO_STUB_DEV_CLAIM_URL;
  }
  return null;
}

/** Reserviert einen der weltweiten Slots (Server muss Zähler führen). */
export async function reservePromoGlobalSlot(endpoint: string): Promise<PromoReserveResult> {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      /** Minimal halten → oft kein CORS-Preflight; Worker liefert JSON. */
      mode: "cors",
      credentials: "omit",
    });
    let j: { ok?: boolean; reason?: string };
    try {
      j = (await r.json()) as typeof j;
    } catch {
      return "bad_response";
    }
    if (j?.ok === true) return "ok";
    if (j?.reason === "full") return "full";
    return "bad_response";
  } catch {
    return "network_error";
  }
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export type PromoRedeemResult =
  | { ok: true; key: string; gems?: number; xp?: number }
  | { ok: false; reason: "unknown" | "used" };

export function describePromoRedeem(raw: string, usedKeys: ReadonlySet<string>): PromoRedeemResult {
  const key = normalizePromoCode(raw);
  if (!key) return { ok: false, reason: "unknown" };
  let gems: number | undefined = PROMO_GEMS[key];
  let xp: number | undefined = undefined;
  if (key === LOCAL_ONLY_COMBO_CODE && isLocalTankArtilleryPromoHost()) {
    gems = LOCAL_ONLY_COMBO_GEMS;
    xp = LOCAL_ONLY_COMBO_XP;
  } else if (gems == null && key === LOCAL_ONLY_PROMO_CODE && isLocalTankArtilleryPromoHost()) {
    gems = LOCAL_ONLY_PROMO_GEMS;
  } else if (gems == null && key === LOCAL_ONLY_MEGA_GEMS_CODE && isLocalTankArtilleryPromoHost()) {
    gems = LOCAL_ONLY_MEGA_GEMS;
  } else if (gems == null && key === LOCAL_ONLY_XP_CODE && isLocalTankArtilleryPromoHost()) {
    xp = LOCAL_ONLY_XP_AMOUNT;
  }
  if (gems == null && xp == null) return { ok: false, reason: "unknown" };
  if (usedKeys.has(key)) return { ok: false, reason: "used" };
  return { ok: true, key, gems: gems ?? undefined, xp };
}

export function readPromoUsedKeys(): Set<string> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PROMO_USED_STORAGE_KEY) : null;
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function addPromoUsedKey(key: string): void {
  const next = readPromoUsedKeys();
  next.add(key);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PROMO_USED_STORAGE_KEY, JSON.stringify([...next]));
    }
  } catch {
    /** ignore */
  }
}

/** Levelkurve konsistent zur Tank-Wars-Anmutung */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
}

export function readXp(): number {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(XP_STORAGE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addXp(dx: number): number {
  const n = Math.max(0, readXp() + dx);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(XP_STORAGE_KEY, String(n));
  } catch {
    /** ignore */
  }
  return n;
}
