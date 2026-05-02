/** Zug-Arillerie — Terrain-Stichprobe (Y nach unten), Ballistik
 * Welt breit wie mobiles Artillery (lange Distanz), etwas weniger G für hängenden Bogen */
export const WORLD = { W: 1680, H: 720, G: 1580 };

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
  /** Extrem: hoher Relief + rauere Oberfläche */
  insane: { ampFrac: 0.118, blurR: 7, blurP: 5, hfMul: 1.9 },
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

/** Viele kleine Geschosse (z. B. Silber „Einstreu“); `dmg`/`splashPx`/… gelten **pro** Kugel. */
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
  /** Leucht-Farben für Geschoss-In-Flight (Panzer-spezifische Optik) */
  glow?: ProjectileGlow;
  pelletBurst?: PelletBurstConfig;
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

export type PlayerTankId = "silver" | "green" | "navy" | "desert";

/** ATLAS-Schlüssel Kenney „Tanks“ */
export type PlayerTankAtlasKey = "tankGrey" | "tankPlayerGreen" | "tankNavy" | "tankDesert";

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
  /** Blitz relativ zu LIGHTNING_DAMAGE */
  blitzMul: number;
}

/** Feld-Green — günstigstes Upgrade nach Silber */
export const GEM_PRICE_TANK_GREEN = 100;
/** Marine — mittlere Tier-Stufe */
export const GEM_PRICE_TANK_NAVY = 280;
/** Wüsten-Speer — stärkstes Kit */
export const GEM_PRICE_TANK_DESERT = 550;

/** @deprecated Alias für {@link GEM_PRICE_TANK_GREEN} */
export const GEM_PRICE_NEW_TANK = GEM_PRICE_TANK_GREEN;

const SILVER_WEAPONS: WeaponDef[] = [
  {
    id: "silv_pop",
    name: "Practice",
    nameDe: "Platzpatrone",
    packLabel: "tank_bullet1.png",
    dmg: 30,
    splashPx: 48,
    craterPx: 26,
    craterLift: 15,
    velMul: 1.1,
    glow: GLOW_SILVER,
  },
  {
    id: "silv_med",
    name: "Light HE",
    nameDe: "Leichtkaliber",
    packLabel: "tank_bullet3.png",
    dmg: 39,
    splashPx: 46,
    craterPx: 34,
    craterLift: 26,
    velMul: 0.99,
    glow: GLOW_SILVER,
  },
  {
    id: "silv_burst",
    name: "Light burst",
    nameDe: "Einstreu",
    packLabel: "tank_bulletFly3.png",
    dmg: 7,
    splashPx: 22,
    craterPx: 11,
    craterLift: 7,
    velMul: 1.1,
    glow: GLOW_SILVER,
    pelletBurst: { count: 16, spreadHalfDeg: 7 },
  },
];

/** Feld-Green: schnelles Kaliber, Rohr-Schwer, Salve — alles eigene Kurven (nicht Navy/Wüste). */
const GREEN_WEAPONS: WeaponDef[] = [
  {
    id: "gr_streak",
    name: "Swift HE",
    nameDe: "Raschsatz",
    packLabel: "tank_bullet1.png",
    dmg: 41,
    splashPx: 49,
    craterPx: 35,
    craterLift: 24,
    velMul: 1.15,
    glow: GLOW_GREEN_A,
  },
  {
    id: "gr_bunker",
    name: "Bunker breaker",
    nameDe: "Panzerfaust‑X",
    packLabel: "tank_bullet3.png",
    dmg: 58,
    splashPx: 46,
    craterPx: 64,
    craterLift: 50,
    velMul: 0.93,
    glow: GLOW_GREEN_B,
  },
  {
    id: "gr_needle",
    name: "Needle swarm",
    nameDe: "Nadelwald",
    packLabel: "tank_bulletFly3.png",
    dmg: 8,
    splashPx: 21,
    craterPx: 9,
    craterLift: 5,
    velMul: 1.07,
    glow: GLOW_GREEN_C,
    pelletBurst: { count: 10, spreadHalfDeg: 9 },
  },
];

const NAVY_WEAPONS: WeaponDef[] = [
  {
    id: "nav_g",
    name: "Naval HE",
    nameDe: "Deckgranate",
    packLabel: "tank_bullet1.png",
    dmg: 50,
    splashPx: 60,
    craterPx: 48,
    craterLift: 36,
    velMul: 1.02,
    glow: GLOW_NAVY,
  },
  {
    id: "nav_h",
    name: "Heavy naval",
    nameDe: "Schiffsartillerie",
    packLabel: "tank_bullet3.png",
    dmg: 70,
    splashPx: 54,
    craterPx: 76,
    craterLift: 60,
    velMul: 0.93,
    glow: GLOW_NAVY,
  },
  {
    id: "nav_s",
    name: "Naval burst",
    nameDe: "Granatsalve",
    packLabel: "tank_bulletFly3.png",
    dmg: 6,
    splashPx: 32,
    craterPx: 15,
    craterLift: 10,
    velMul: 1.08,
    glow: GLOW_NAVY,
    pelletBurst: { count: 14, spreadHalfDeg: 6.5 },
  },
];

const DESERT_WEAPONS: WeaponDef[] = [
  {
    id: "des_g",
    name: "Sun HE",
    nameDe: "Wüsten-HE",
    packLabel: "tank_bullet1.png",
    dmg: 56,
    splashPx: 64,
    craterPx: 54,
    craterLift: 40,
    velMul: 1.01,
    glow: GLOW_DESERT,
  },
  {
    id: "des_h",
    name: "Canyon bore",
    nameDe: "Panzerjäger",
    packLabel: "tank_bullet3.png",
    dmg: 78,
    splashPx: 56,
    craterPx: 82,
    craterLift: 64,
    velMul: 0.91,
    glow: GLOW_DESERT,
  },
  {
    id: "des_s",
    name: "Sand burst",
    nameDe: "Sandsturm",
    packLabel: "tank_bulletFly3.png",
    dmg: 13,
    splashPx: 36,
    craterPx: 18,
    craterLift: 14,
    velMul: 1.02,
    glow: GLOW_DESERT,
    pelletBurst: { count: 8, spreadHalfDeg: 14 },
  },
];

export const PLAYER_TANKS: readonly PlayerTankDef[] = [
  {
    id: "silver",
    nameDe: "Silber-Chassis",
    subtitleDe: "Starter — feine Silber-Spur · Einstreu: 16 Treffer zu je 7.",
    priceGems: 0,
    atlasSprite: "tankGrey",
    maxHp: 118,
    weapons: SILVER_WEAPONS,
    blitzMul: 0.85,
  },
  {
    id: "green",
    nameDe: "Feld-Green",
    subtitleDe: "Waldgrün · Raschsatz (schnell) · Panzerfaust‑X (Knall) · Nadelwald (10 Splitter).",
    priceGems: GEM_PRICE_TANK_GREEN,
    atlasSprite: "tankPlayerGreen",
    maxHp: 124,
    weapons: GREEN_WEAPONS,
    blitzMul: 1,
  },
  {
    id: "navy",
    nameDe: "Marine",
    subtitleDe: "Deckgranate / Schiffsartillerie / Granatsalve mit 14 Seekügeln — alles marines Leuchten.",
    priceGems: GEM_PRICE_TANK_NAVY,
    atlasSprite: "tankNavy",
    maxHp: 130,
    weapons: NAVY_WEAPONS,
    blitzMul: 1.08,
  },
  {
    id: "desert",
    nameDe: "Wüsten-Speer",
    subtitleDe: "Wüsten-HE / Panzerjäger / Sandsturm: breite Splitter-Kegel wie ein Staubteufel.",
    priceGems: GEM_PRICE_TANK_DESERT,
    atlasSprite: "tankDesert",
    maxHp: 136,
    weapons: DESERT_WEAPONS,
    blitzMul: 1.14,
  },
];

export function getPlayerTankDef(id: PlayerTankId): PlayerTankDef | undefined {
  return PLAYER_TANKS.find((t) => t.id === id);
}

export const TANK_STORAGE_OWNED = "tank-artillery-tanks-owned-v1";
export const TANK_STORAGE_EQUIPPED = "tank-artillery-tank-equipped-v1";

const ALL_TANK_IDS: ReadonlySet<PlayerTankId> = new Set(["silver", "green", "navy", "desert"]);

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
    if (rid === "silver" || rid === "green" || rid === "navy" || rid === "desert") {
      const owned = readOwnedTankIds();
      if (owned.includes(rid)) return rid;
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

/** Wüsten-Panzer Kristallschild (Shop) — 500 💎, je Aktivierung +50 Absorption diese Runde · pro Kauf 3 Aktivierungen (unabhängig von Blitz/Runden-Rhythmus). */
export const DESERT_SHIELD_PRICE_GEMS = 500;
export const DESERT_SHIELD_ABSORB = 50;
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

/** Shop-Kosmetik: Spur-Effekt in der Fahrphase (← →), nur Optik. */
export type PurchasableMoveTrailId = "fire" | "lightning";
export type MoveTrailCosmeticId = "none" | PurchasableMoveTrailId;

export const MOVE_TRAIL_FIRE_PRICE_GEMS = 85;
export const MOVE_TRAIL_LIGHTNING_PRICE_GEMS = 110;
export const MOVE_TRAIL_OWNED_KEY = "tank-artillery-move-trails-owned-v1";
export const MOVE_TRAIL_EQUIPPED_KEY = "tank-artillery-move-trail-equipped-v1";

const PURCHASABLE_TRAIL_IDS: ReadonlySet<PurchasableMoveTrailId> = new Set(["fire", "lightning"]);

function parseOwnedMoveTrails(raw: string | null): PurchasableMoveTrailId[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: PurchasableMoveTrailId[] = [];
    for (const x of arr) {
      if (x === "fire" || x === "lightning") out.push(x);
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
    if (raw === "fire" || raw === "lightning") {
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
  const price = id === "fire" ? MOVE_TRAIL_FIRE_PRICE_GEMS : MOVE_TRAIL_LIGHTNING_PRICE_GEMS;
  if (readGems() < price) return "expensive";
  if (!spendGems(price)) return "expensive";
  addOwnedMoveTrail(id);
  void setEquippedMoveTrail(id);
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

export interface ImpactResult {
  x: number;
  y: number;
}

export function simulateUntilImpact(
  surface: TerrainSurface,
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  windAccel: number,
  dt = 1 / 220,
): ImpactResult {
  let x = x0;
  let y = y0;
  let vxv = vx;
  let vyv = vy;

  const w = surface.y.length;
  const g = WORLD.G;
  const maxSteps = 220_000;

  for (let s = 0; s < maxSteps; s++) {
    vxv += windAccel * dt;
    vyv += g * dt;
    x += vxv * dt;
    y += vyv * dt;
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
): Vec2[] {
  const pts: Vec2[] = [];
  let x = x0;
  let y = y0;
  let vxW = vx;
  let vz = vy;

  const w = surface.y.length;
  const g = WORLD.G;
  for (let i = 0; i < maxPts; i++) {
    vxW += windAccel * dt;
    vz += g * dt;
    x += vxW * dt;
    y += vz * dt;
    pts.push({ x, y });
    const gd = heightAt(surface, x);
    if (y >= gd || x < -20 || x > w + 20) {
      pts.push({ x, y: Math.min(y, gd) });
      break;
    }
  }
  return pts;
}

/** Splash-Schaden zwischen Explosionspunkt und Mittelpunkt eines Ziels (basis unten) */
export function splashDamage(
  ex: number,
  ey: number,
  enemyX: number,
  enemyYBase: number,
  enemyHalfW: number,
  enemyHalfH: number,
  splashR: number,
  dmgMax: number,
): number {
  const cx = enemyX;
  const cy = enemyYBase - enemyHalfH;
  const d = Math.hypot(ex - cx, ey - cy);
  const thresh = splashR + Math.max(enemyHalfW, enemyHalfH * 1.15);
  if (d >= thresh) return 0;
  return dmgMax * Math.max(0, 1 - d / thresh);
}

export const TANK_HALF_W = 22;
export const TANK_HALF_H = 17;

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
export const FUEL_MOVE = 210;
export const XP_STORAGE_KEY = "tank-artillery-xp";
export const XP_WIN = 36;
export const GEM_STORAGE_KEY = "tank-artillery-gems";
/** Nach erfolgreicher Phrase gesetzt → praktisch unbegrenzte 💎 nur in diesem Browser. */
export const ADMIN_GEMS_UNLOCK_STORAGE_KEY = "tank-artillery-admin-gems-unlock-v1";

const ADMIN_EFFECTIVE_GEM_BALANCE = Number.MAX_SAFE_INTEGER;

/** Bei Sieg: zufällig inklusive [GEM_WIN_MIN, GEM_WIN_MAX] */
export const GEM_WIN_MIN = 50;
export const GEM_WIN_MAX = 120;

/**
 * Sieg-Gems auf [GEM_WIN_MIN, GEM_WIN_MAX] (jede ganze Zahl gleich wahrscheinlich).
 * `random01` liefert Werte aus [0, 1).
 */
export function rollGemsForWin(random01: () => number): number {
  const span = GEM_WIN_MAX - GEM_WIN_MIN + 1;
  const u = random01();
  const clamped = Math.min(0.999_999_999_999_999_9, Math.max(0, u));
  return GEM_WIN_MIN + Math.floor(clamped * span);
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

/** Nur lokaler Dev-Code „seba1“: Einlösung ohne `/claim` — kein promo-stub nötig. */
export function promoSkipsGlobalSlotReserve(normalizedKey: string): boolean {
  return (
    isLocalTankArtilleryPromoHost() &&
    (normalizedKey === LOCAL_ONLY_PROMO_CODE || normalizedKey === LOCAL_ONLY_XP_CODE)
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
  let gems = PROMO_GEMS[key];
  let xp: number | undefined = undefined;
  if (gems == null && key === LOCAL_ONLY_PROMO_CODE && isLocalTankArtilleryPromoHost()) {
    gems = LOCAL_ONLY_PROMO_GEMS;
  }
  if (gems == null && key === LOCAL_ONLY_XP_CODE && isLocalTankArtilleryPromoHost()) {
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
