import "./style.css";
import {
  ATLAS,
  GENERATED_TANK_SPRITES,
  SPRITESHEET_REL,
  type GeneratedTankSpriteDef,
  type GeneratedTankSpriteKey,
} from "./kenney-atlas";
import {
  BLITZ_DISPLAY_NAME_DE,
  DEFAULT_HP,
  DEFAULT_PROJECTILE_GLOW,
  FUEL_MOVE,
  LIGHTNING_CRATER_DEPTH,
  LIGHTNING_CRATER_PX,
  LIGHTNING_DAMAGE,
  LIGHTNING_SPLASH_PX,
  PLAYER_TANKS,
  TANK_HALF_H,
  TANK_HALF_W,
  WEAPONS,
  WORLD,
  addXp,
  addGems,
  addPromoUsedKey,
  describePromoRedeem,
  getPlayerTankDef,
  getEquippedPlayerTank,
  promoClaimEndpoint,
  promoSkipsGlobalSlotReserve,
  readOwnedTankIds,
  readPromoUsedKeys,
  reservePromoGlobalSlot,
  rollGemsForWin,
  readGems,
  isLocalTankArtilleryPromoHost,
  unlockAdminGems,
  adminGemsUnlocked,
  setEquippedTankId,
  applyCrater,
  buildTerrain,
  heightAt,
  terrainHullPose,
  terrainBlocksBarrelRay,
  levelFromXp,
  readXp,
  readMapDifficulty,
  readMapBattleTheme,
  setMapDifficulty,
  setMapBattleTheme,
  XP_STORAGE_KEY,
  sampleTrajectory,
  simulateUntilImpact,
  splashDamage,
  tryBuyTank,
  tryBuyDesertShield,
  tryBuyMoveTrailCosmetic,
  readEquippedMoveTrail,
  readOwnedMoveTrailIds,
  setEquippedMoveTrail,
  MOVE_TRAIL_FIRE_PRICE_GEMS,
  MOVE_TRAIL_LIGHTNING_PRICE_GEMS,
  type PurchasableMoveTrailId,
  type MoveTrailCosmeticId,
  consumeDesertShieldActivation,
  DESERT_SHIELD_ABSORB,
  DESERT_SHIELD_PRICE_GEMS,
  DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE,
  readDesertShieldCharges,
  readDesertShieldOwned,
  readEquippedTankId,
  readLockerUpgradeLevels,
  readLockerUpgradeLevelsFor,
  lockerUpgradeFuelBonus,
  lockerUpgradePowMaxDelta,
  lockerUpgradeDamageMul,
  lockerUpgradeStepCostGems,
  tryBuyLockerUpgrade,
  LOCKER_UPGRADE_META,
  LOCKER_UPGRADE_MAX_LEVEL,
  type LockerUpgradeBranchId,
  velocityFromElevDeg,
  jitteredShotVelocity,
  XP_WIN,
  type ProjectileGlow,
  type TerrainSurface,
  type WeaponDef,
  type PlayerTankId,
  type PlayerTankDef,
  type MapBattleTheme,
  lockerMaxBonusWeaponFor,
  lockerMaxSpecialAttackUnlocked,
} from "./artillery-logic";
import { currentFullscreenElement, fullscreenToggleStrings, toggleRootFullscreen } from "./fullscreen";

declare global {
  interface Window {
    /** Nur Vite-Dev: Playwright öffnet das Sieg-Menü ohne echte Partie. */
    __TA_DEV_SHOW_WIN_MENU__?: () => void;
  }
}

/**
 * Viele Bahnpunkte bei ähnlichem dt wie simulation → lange, klare Geschoss-Animation (Sprites).
 */
const FLIGHT_MAX_PTS = 4200;
const FLIGHT_DT = 1 / 110;
/** Pro Frame Index-Schritt — kleiner = langsamer fliegender Schuss auf dem Bild. */
const FLIGHT_FRAME_ADV = 2;

function weaponDragMul(W: WeaponDef): number {
  return W.ballisticDragMul ?? 1;
}

/** Jedes Kampf-/Neustart (`begin` / „Weiter“ / „Ins Spiel“) erhöht `kampfNr` → Blitz jede dritte (3., 6., …) */
const BLITZ_EVERY_MATCH = 3;
/** Zufälliger „Begleiter“ beim Blitz (nur wenn diese Runde Blitz aktiv ist) — Flavor-Text */
const BLITZ_BUDDY_NAMES_DE = [
  "Yuki",
  "Marco",
  "Nina",
  "Leo",
  "Finn",
  "Sofi",
  "Ben",
  "Lara",
];
/** Pool für Gegner-Panzer — grün, marine, sandfarben („white“ / Wüsten-Skin), silber-grau */
type EnemyTankSkin = "green" | "navy" | "white" | "silver";

/** Blitz-Splash — Radius aus Logik (gleiche Quelle wie Vitest) */
const BLITZ_SPLASH_PX = LIGHTNING_SPLASH_PX;
const LIGHTNING_BOLT_MS = 720;
const VIEW_W = WORLD.W;
const VIEW_H = WORLD.H;

/** Aktiver Blitz-Strahl: ein Ableiter von oben (Fork jagA/jagB) */
let lightningBolt: null | {
  t0: number;
  cx: number;
  gy: number;
  jagA: number[];
  jagB: number[];
} = null;

let lightningBannerUntil = 0;
let lightningBannerLines: string[] = [];

type Ph = "m" | "aim" | "pf" | "bw" | "bf";

/** Laufende Kampf-Nummer seit Programmstart — resetMatchRound erhöht sie (3., 6., … = Blitz-Welle) */
let kampfNr = 0;

let rngSeed = 884_221;
function roll(): number {
  rngSeed |= 0;
  rngSeed = (rngSeed * 1103515245 + 12345) >>> 0;
  return rngSeed / 4294967296;
}

function blitzWaveUnlockedForCurrentMatch(): boolean {
  return kampfNr >= BLITZ_EVERY_MATCH && kampfNr % BLITZ_EVERY_MATCH === 0;
}

function canUseBlitzNow(): boolean {
  return blitzWaveUnlockedForCurrentMatch() && !blitzConsumedThisMatch;
}

function canActivateDesertShieldNow(): boolean {
  return (
    activeTankId() === "desert" &&
    readDesertShieldOwned() &&
    playerShieldAbsorb <= 0
  );
}

function tryActivateDesertShieldFromKeys(): boolean {
  if (!canActivateDesertShieldNow()) return false;
  playerShieldAbsorb = DESERT_SHIELD_ABSORB;
  consumeDesertShieldActivation();
  const left = readDesertShieldCharges();
  shieldBannerUntil = performance.now() + 2400;
  shieldBannerLines = [
    "Sonnenkristall-Schild",
    `${DESERT_SHIELD_ABSORB} Punkte Schutz aktiv${left > 0 ? ` · noch ${left} Aktivierungen` : " · Paket aufgebraucht — neu im Shop"}`,
  ];
  shieldImpactUntil = performance.now() + 420;
  shieldImpactAbsorbed = DESERT_SHIELD_ABSORB;
  return true;
}

/** Wie viele neue Kämpfe bis Blitz-Verfb (0 = Blitz jetzt möglich, wenn Welle aktiv und nicht gebraucht) */
function rundenBisBlitzAnzeige(): number {
  const d = kampfNr % BLITZ_EVERY_MATCH;
  if (d !== 0) return BLITZ_EVERY_MATCH - d;
  if (kampfNr < BLITZ_EVERY_MATCH) return BLITZ_EVERY_MATCH;
  return 0;
}

function pickEnemyTankSkin(): EnemyTankSkin {
  const u = roll();
  if (u < 1 / 4) return "green";
  if (u < 2 / 4) return "navy";
  if (u < 3 / 4) return "white";
  return "silver";
}

let T: TerrainSurface;
/** Aktives Kampf-Thema (Erde / Mond) — bei `begin()` aus dem Speicher gelesen */
let mapBattleTheme: MapBattleTheme = "earth";
let mapDifficulty = readMapDifficulty();
/** Breite der aktuellen Welt (Insane kann breiter sein). */
let worldW = WORLD.W;
/** Kamera-Offset (nur relevant wenn worldW > VIEW_W). */
let camX = 0;
let seed = (Date.now() % 1_000_000) >>> 0;
let px = 156;
let bx = VIEW_W - 156;
/** Max. LP dieser Partie (von ausgerüstetem Panzer — Gegner gleich). */
let battleMaxHp = DEFAULT_HP;
let hpP = DEFAULT_HP;
let hpB = DEFAULT_HP;
let fuelP = FUEL_MOVE;
let fuelB = Math.floor(FUEL_MOVE * 0.9);
const PLAYER_POW_MIN = 380;
const PLAYER_POW_MAX_BASE = 1220;

function playerFuelCapacity(): number {
  return FUEL_MOVE + lockerUpgradeFuelBonus(readLockerUpgradeLevelsFor(activeTankId()).fuel);
}

function playerPowMax(): number {
  return PLAYER_POW_MAX_BASE + lockerUpgradePowMaxDelta(readLockerUpgradeLevelsFor(activeTankId()).power);
}

function playerDamageMulVersusBot(): number {
  return lockerUpgradeDamageMul(readLockerUpgradeLevelsFor(activeTankId()).damage);
}

let ang = 53;
/** Rohr-Anzeige fürs Zeichnen — nähert sich `ang`/Ziel, damit das Rohr sichtbar auslenkt */
let barrelVisAng = ang;
/** Nach Schuss: Rohr kickt kurz hoch und federt aus (nur Anzeige). */
let barrelRecoilDeg = 0;
let enemyBarrelRecoilDeg = 0;
/** Winkelgeschwindigkeit fürs sichtbare Rohr (Feder–Dämpfer → Einpendeln mit Bewegung). */
let barrelVisVel = 0;
let enemyBarrelVel = 0;
let pow = 480;
/** 0… = Geschosse aus {@link pw}; {@link blitzSlotIndex} = Blitz (Taste 4). */
let selectedSlot = 0;
/** Aktives Geschossprofil nur fürs Flug-Sprite (Spieler oder Bot-Zug) */
let projectileInFlightStyle: ProjectileGlow | null = null;

let testDriveTankId: PlayerTankId | null = null;
/** Shop-Test einer Fahr-Spur (Feuer/Blitz) ohne Kauf — nur Optik. */
let testDriveMoveTrailId: PurchasableMoveTrailId | null = null;
function testDriveActive(): boolean {
  return testDriveTankId != null;
}
function testMoveTrailActive(): boolean {
  return testDriveMoveTrailId != null;
}
/** Panzer- und/oder Spur-Testspiel: normale Welt, keine Belohnungen. */
function battleTestModeActive(): boolean {
  return testDriveActive() || testMoveTrailActive();
}
function activeTankId(): PlayerTankId {
  return testDriveTankId ?? readEquippedTankId();
}
function activeTankDef(): PlayerTankDef {
  if (!testDriveTankId) return getEquippedPlayerTank();
  return getPlayerTankDef(testDriveTankId) ?? getEquippedPlayerTank();
}

function lockerMaxSpecialUnlocked(): boolean {
  return lockerMaxSpecialAttackUnlocked(readLockerUpgradeLevelsFor(activeTankId()));
}
/** Blitz-Tastatur-Slot: 3 ohne Spezial (6), 4 wenn Spezial freigeschaltet ist. */
function blitzSlotIndex(): number {
  return lockerMaxSpecialUnlocked() ? 4 : 3;
}
function isBlitzSlot(slot: number): boolean {
  return slot === blitzSlotIndex();
}

function effectiveMoveTrail(): MoveTrailCosmeticId {
  if (testDriveMoveTrailId != null) return testDriveMoveTrailId;
  return readEquippedMoveTrail();
}

function battleTestOverlaySuffix(): string {
  const parts: string[] = [];
  if (testDriveActive()) parts.push(activeTankDef().nameDe);
  if (testMoveTrailActive()) parts.push(testDriveMoveTrailId === "fire" ? "Feuerspur" : "Blitzspur");
  return parts.join(" · ");
}

function hudBattleTestPrefix(): string {
  if (!battleTestModeActive()) return "";
  return `TEST · ${battleTestOverlaySuffix()} · Normal · `;
}

function pw(): WeaponDef[] {
  const base = activeTankDef().weapons;
  return lockerMaxSpecialUnlocked() ? [...base, lockerMaxBonusWeaponFor(activeTankId())] : base;
}

function atlasRectPlayer(): { x: number; y: number; w: number; h: number } {
  const k = activeTankDef().atlasSprite;
  return ATLAS[k];
}

type TankVisualFx = {
  halo: string;
  ring: string;
  spark: string;
  core: string;
};

function tankVisualFx(id: PlayerTankId): TankVisualFx | null {
  switch (id) {
    case "navy":
      return {
        halo: "rgba(56,189,248,0.34)",
        ring: "rgba(125,211,252,0.74)",
        spark: "rgba(186,230,253,0.9)",
        core: "rgba(14,165,233,0.42)",
      };
    case "desert":
      return {
        halo: "rgba(251,191,36,0.32)",
        ring: "rgba(253,224,71,0.76)",
        spark: "rgba(254,240,138,0.94)",
        core: "rgba(249,115,22,0.42)",
      };
    case "crimson":
      return {
        halo: "rgba(248,113,113,0.35)",
        ring: "rgba(252,165,165,0.78)",
        spark: "rgba(254,202,202,0.94)",
        core: "rgba(220,38,38,0.46)",
      };
    case "bunker":
      return {
        halo: "rgba(129,140,248,0.34)",
        ring: "rgba(199,210,254,0.8)",
        spark: "rgba(224,231,255,0.95)",
        core: "rgba(79,70,229,0.44)",
      };
    case "viper":
      return {
        halo: "rgba(74,222,128,0.36)",
        ring: "rgba(134,239,172,0.82)",
        spark: "rgba(220,252,231,0.96)",
        core: "rgba(22,163,74,0.48)",
      };
    default:
      return null;
  }
}

function drawTankVisualFxLocal(
  g: CanvasRenderingContext2D,
  id: PlayerTankId,
  dw: number,
  dh: number,
  timeMs: number,
  intensity = 1,
): void {
  const fx = tankVisualFx(id);
  if (!fx || intensity <= 0) return;

  const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.0043);
  const lift = dh * 0.46;

  g.save();
  g.beginPath();
  g.rect(-dw * 6, -dh * 6, dw * 12, dh * 6);
  g.clip();
  g.globalCompositeOperation = "lighter";

  const halo = g.createRadialGradient(0, -lift, 2, 0, -lift, dw * (0.58 + pulse * 0.08));
  halo.addColorStop(0, fx.core);
  halo.addColorStop(0.58, fx.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 0.68 * intensity;
  g.fillStyle = halo;
  g.beginPath();
  g.ellipse(0, -lift, dw * 0.74, dh * 0.62, 0, 0, Math.PI * 2);
  g.fill();

  g.globalAlpha = (0.3 + pulse * 0.22) * intensity;
  g.strokeStyle = fx.ring;
  g.lineWidth = Math.max(1.2, dw * 0.018);
  g.beginPath();
  g.ellipse(0, -dh * 0.38, dw * (0.54 + pulse * 0.04), dh * 0.34, 0, 0, Math.PI * 2);
  g.stroke();

  const count = id === "bunker" ? 5 : id === "viper" ? 9 : 7;
  for (let i = 0; i < count; i++) {
    const a = timeMs * (0.0019 + i * 0.00013) + i * 1.97;
    const x = Math.cos(a) * dw * (0.34 + (i % 3) * 0.055);
    const y = -dh * (0.42 + Math.sin(a * 1.31) * 0.17);
    const r = Math.max(1.2, dw * (0.014 + (i % 2) * 0.006)) * intensity;
    g.globalAlpha = (0.42 + pulse * 0.34) * intensity;
    g.fillStyle = fx.spark;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  if (id === "crimson" || id === "viper") {
    g.globalAlpha = 0.44 * intensity;
    g.strokeStyle = fx.ring;
    g.lineWidth = Math.max(1.4, dw * 0.022);
    g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const y = -dh * (0.22 + i * 0.16) + Math.sin(timeMs * 0.004 + i) * 2;
      g.beginPath();
      g.moveTo(-dw * 0.58, y);
      g.lineTo(-dw * (0.36 + i * 0.03), y - dh * 0.08);
      g.stroke();
    }
  }

  if (id === "bunker") {
    g.globalAlpha = 0.36 * intensity;
    g.strokeStyle = fx.ring;
    g.lineWidth = Math.max(1.3, dw * 0.018);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      const x = Math.cos(a) * dw * 0.38;
      const y = -dh * 0.5 + Math.sin(a) * dh * 0.28;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
  }

  g.restore();
}

function customSpriteKeyForTank(def: PlayerTankDef): GeneratedTankSpriteKey | null {
  const key = def.customSprite;
  if (key === "redStriker" || key === "viperEnergy" || key === "bunkerShield") return key;
  return null;
}

function drawGeneratedTankSpriteLocal(
  g: CanvasRenderingContext2D,
  key: GeneratedTankSpriteKey,
  tankId: PlayerTankId,
  frameIndex: number,
  desiredFacingRight: boolean,
  timeMs: number,
  targetScale = 1,
  fxIntensity = 1,
): boolean {
  const def = GENERATED_TANK_SPRITES[key];
  const img = generatedTankImages[key];
  if (!img?.complete || img.naturalWidth < 16) return false;
  const frame = def.frames[Math.max(0, Math.min(def.frames.length - 1, frameIndex))]!;
  const bodyW = def.targetW * targetScale;
  const sc = bodyW / def.sourceBodyW;
  const dw = frame.w * sc;
  const dh = frame.h * sc;
  const bodyH = def.sourceBodyH * sc;
  const sx = frameIndex * def.frameW + frame.x;

  g.save();
  if (def.sourceFacesRight !== desiredFacingRight) g.scale(-1, 1);
  if (fxIntensity > 0) drawTankVisualFxLocal(g, tankId, bodyW, bodyH, timeMs, fxIntensity);
  g.drawImage(img, sx, frame.y, frame.w, frame.h, -dw / 2, -dh, dw, dh);
  g.restore();
  return true;
}
/** In dieser Kampf-Runde bereits abgefeuert (nur relevant wenn Blitz-Welle aktiv) */
let blitzConsumedThisMatch = false;
/** Wüsten-Schild: begrenzt nur durch Gesamt-Ladungen (Storage), nicht pro Runde/Kampf. */
/** Aktueller Schadens-Puffer — kein echtes Max-HP, wird durch Treffer verbraucht */
let playerShieldAbsorb = 0;
/** Kurzes Banner beim Schild aktivieren */
let shieldBannerUntil = 0;
let shieldBannerLines: string[] = [];
let shieldImpactUntil = 0;
let shieldImpactAbsorbed = 0;
/** Zufälliger Name für Blitz-Banner, pro freigeschalteter Runde neu */
let blitzBuddyDe = "";
/** Horizont-Position eines Blitz-Einschlags auf der Map (Welten-X) */
let blitzStrikeX = VIEW_W * 0.52;
let wa = 0;
let ph: Ph = "m";
let tr: Array<{ x: number; y: number }> = [];
/** Parallele Kügelchen (z. B. Silber „Einstreu“) */
type PlayerPelletFlight = {
  pts: Array<{ x: number; y: number }>;
  hit: { x: number; y: number };
  ti: number;
  applied: boolean;
};
let playerPelletFlights: PlayerPelletFlight[] | null = null;
let ti = 0;
let bθ = 52;
/** Sichtbare Gegner-Röhre (wie `barrelVisAng` beim Spieler) */
let enemyBarrelVisDeg = bθ;
let bPow = 490;
/** Gegner: je Kampf zufällig (grün, marine-blau, Wüsten-Beige, grau-silbern) */
let enemyTankSkin: EnemyTankSkin = "navy";

let bwI = 0;
let bWait = 0;
/** Mündungsblitz Ende (Zeit wie performance.now()). */
let muzzleExpire = 0;
let botMuzzleExpire = 0;
/** Nach „Schuss gegen Wand“: kurzer Hinweis in der Statuszeile. */
let barrelBlockedHintUntil = 0;
/** kurzes Zittern nach Einschlag */
let shakeUntil = 0;

type ImpactBurstStyle = "default" | "electric" | "dust" | "pellet" | "poison";

type ImpactBurstFx = {
  x: number;
  y: number;
  t0: number;
  splash: number;
  style?: ImpactBurstStyle;
};

const IMPACT_BURST_CAP = 40;

type DriveTrailParticle = {
  x: number;
  y: number;
  born: number;
  vx: number;
  vy: number;
  kind: "ember" | "spark";
};
/** Kräftigere Spur: mehr Partikel, längere Lebensdauer. */
const DRIVE_TRAIL_MAX = 96;
const DRIVE_TRAIL_MAX_AGE_MS = 820;
let driveTrailParticles: DriveTrailParticle[] = [];

function clearDriveTrailParticles(): void {
  driveTrailParticles = [];
}

function spawnDriveTrailForMove(deltaPx: number): void {
  const trail = effectiveMoveTrail();
  if (trail === "none") return;
  const sign = Math.sign(deltaPx);
  if (sign === 0) return;
  const rearX = px - sign * 46;
  const rearBaseY = pv(px) + 14;
  const now = performance.now();
  const count = trail === "fire" ? 11 : 9;
  const kind: DriveTrailParticle["kind"] = trail === "fire" ? "ember" : "spark";
  for (let i = 0; i < count; i++) {
    driveTrailParticles.push({
      x: rearX + (roll() - 0.5) * 22,
      y: rearBaseY + (roll() - 0.5) * 16,
      born: now,
      vx: -sign * (1.2 + roll() * 3.4) + (roll() - 0.5) * 1.2,
      vy: -1.4 - roll() * 3.2,
      kind,
    });
  }
  if (driveTrailParticles.length > DRIVE_TRAIL_MAX) {
    driveTrailParticles.splice(0, driveTrailParticles.length - DRIVE_TRAIL_MAX);
  }
}

function tickDriveTrailParticles(): void {
  const now = performance.now();
  driveTrailParticles = driveTrailParticles.filter((p) => now - p.born < DRIVE_TRAIL_MAX_AGE_MS);
  for (const p of driveTrailParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.kind === "ember" ? 0.09 : 0.05;
    p.vx *= p.kind === "ember" ? 0.965 : 0.97;
  }
}

function drawDriveTrailParticlesLayer(now: number): void {
  if (driveTrailParticles.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const life = DRIVE_TRAIL_MAX_AGE_MS;
  for (const p of driveTrailParticles) {
    const age = now - p.born;
    const t = age / life;
    const a = Math.max(0, 1 - t * 1.05);
    if (a <= 0.02) continue;
    if (p.kind === "ember") {
      const r = 5 + t * 16;
      ctx.globalAlpha = a * 0.55;
      const outer = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.15);
      outer.addColorStop(0, `rgba(254,215,170,${0.5 * a})`);
      outer.addColorStop(0.45, `rgba(251,113,133,${0.35 * a})`);
      outer.addColorStop(0.75, `rgba(220,38,38,${0.2 * a})`);
      outer.addColorStop(1, "rgba(69,10,10,0)");
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.98;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.18, `rgba(254,249,195,${0.98 * a})`);
      grd.addColorStop(0.42, `rgba(250,204,21,${0.85 * a})`);
      grd.addColorStop(0.68, `rgba(249,115,22,${0.65 * a})`);
      grd.addColorStop(0.88, `rgba(185,28,28,${0.28 * a})`);
      grd.addColorStop(1, "rgba(69,10,10,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = `rgba(254,240,138,${a})`;
      ctx.beginPath();
      ctx.arc(p.x - r * 0.22, p.y - r * 0.28, Math.max(1.8, r * 0.22), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const zig = 12 * Math.sin(age / 28 + p.x * 0.11);
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = `rgba(59,130,246,${0.65 * a})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 26;
      ctx.shadowColor = "rgba(147,197,253,0.95)";
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y + zig * 0.35);
      ctx.lineTo(p.x + 1, p.y - zig);
      ctx.lineTo(p.x + 9, p.y + zig * 0.2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.88;
      ctx.strokeStyle = `rgba(224,242,254,${0.75 + 0.25 * (1 - t)})`;
      ctx.lineWidth = 3.2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(56,189,248,0.9)";
      ctx.beginPath();
      ctx.moveTo(p.x - 5, p.y + zig * 0.4);
      ctx.lineTo(p.x + 2, p.y - zig * 0.92);
      ctx.lineTo(p.x + 7, p.y + zig * 0.22);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = a * 0.95;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y + 1);
      ctx.lineTo(p.x + 5, p.y - 4);
      ctx.stroke();
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = `rgba(196,181,253,${a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x + 3, p.y - 2);
      ctx.lineTo(p.x + 11, p.y + zig * 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function impactFxStyle(W: WeaponDef): ImpactBurstStyle {
  if (W.id === "viper_gift_bomb") return "poison";
  const pb = W.pelletBurst;
  if (pb && pb.spreadHalfDeg >= 11) return "dust";
  if (pb) return "pellet";
  return "default";
}

function maxImpactBurstAgeMs(style: ImpactBurstStyle | undefined): number {
  switch (style) {
    case "dust":
      return 880;
    case "pellet":
      return 720;
    case "electric":
      return 700;
    case "poison":
      return 900;
    default:
      return 640;
  }
}

/** Überlappende Einschlags-Particles — bei Pellet-Waffen nacheinander, sonst nur ein Burst sichtbar. */
let impactBursts: ImpactBurstFx[] = [];

function pushImpactBurst(b: ImpactBurstFx): void {
  impactBursts.push(b);
  if (impactBursts.length > IMPACT_BURST_CAP) {
    impactBursts.splice(0, impactBursts.length - IMPACT_BURST_CAP);
  }
}

function clampBlitzAim(): void {
  const pad = TANK_HALF_W + 92;
  blitzStrikeX = Math.max(pad, Math.min(worldW - pad, blitzStrikeX));
}

/** Setzt Position wenn Spieler auf 4 für Blitz wechselt */
function refreshBlitzAimAroundTanks(): void {
  blitzStrikeX = (px + bx) / 2;
  clampBlitzAim();
}
/** Aufgeben-Dialog: 0 zu, 1 erste Frage, 2 zweite Sicherheit */
let surrenderStep: 0 | 1 | 2 = 0;
/** Ende der Partie: Overlay mit großer Meldung, bis „Weiter“ / „Nochmal versuchen“. */
let matchResult: null | "win" | "lose" | "surrender" = null;

/** Lobby-Unterzeile — Originaltext, nach Aufgeben zeitweise Hinweis */
let defaultLobbyLeadShort = "Wind · Gelände · Krater — Siege bringen XP und 💎.";
let lobbyLeadResetTimer = 0;

/** Aufgeben-Rückkehr zur Lobby ruft bereits `begin()` — „Ins Spiel“ das nächste Mal nicht zweimal erhöhen. */
let skipBeginOnceOnEnterGame = false;

let ctx: CanvasRenderingContext2D;
let cv: HTMLCanvasElement;
/** Kenney Retina-Spritesheet (`public/games/tank-artillery/kenney/tanks_spritesheetRetina.png`) */
let spriteSheet: HTMLImageElement | null = null;
const generatedTankImages: Partial<Record<GeneratedTankSpriteKey, HTMLImageElement>> = {};
let playerTankMotionUntil = 0;

let lobbyTankCv: HTMLCanvasElement | null = null;
let lobbyTankCx: CanvasRenderingContext2D | null = null;
let lobbyTankAnim = 0;
/** Shop/Locker: Panzer-Vorschau beim Antippen einer Karte (null → ausgerüsteter Panzer). */
let hubShopLockerPreviewTankId: PlayerTankId | null = null;
let hubPreviewAnim = 0;
/** Shop-Vorschau: seltener neu zeichnen + sofort bei Auswahl. */
let hubPreviewLastPaintMs = 0;
let hubPreviewPaintUrgent = false;
const HUB_PREVIEW_FRAME_INTERVAL_MS = 1000 / 28;

const HUD_FF = `"Nunito","Segoe UI Emoji","Segoe UI","Apple Color Emoji",system-ui,sans-serif`;

/** Canvas `roundRect`, ältere Umgebungen: Pfad ohne Zeichnen */
function pathRoundRect(x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Lebensbalken schwebend über den Panzern */
function drawLifeBar(centerX: number, hullBottomY: number, hpNow: number, maxHp: number, side: "left" | "right"): void {
  const barW = 84;
  const barH = 16;
  const lift = side === "left" ? 96 : 98;
  const y = hullBottomY - lift;
  const x = centerX - barW / 2;
  const pct = Math.max(0, Math.min(1, hpNow / Math.max(1, maxHp)));
  const innerMax = barW - 10;
  const iw = Math.max(0, innerMax * pct);
  ctx.save();
  pathRoundRect(x, y, barW, barH, 9);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();
  pathRoundRect(x + 5, y + 4, innerMax, barH - 8, 5);
  ctx.fillStyle = "#475569";
  ctx.fill();
  if (iw > 0.5) {
    const g = ctx.createLinearGradient(x + 5, y, x + 5 + innerMax, y);
    if (side === "left") {
      g.addColorStop(0, "#4ade80");
      g.addColorStop(0.45, "#facc15");
      g.addColorStop(1, "#f97316");
    } else {
      g.addColorStop(0, "#f472b6");
      g.addColorStop(0.55, "#a855f7");
      g.addColorStop(1, "#7c3aed");
    }
    ctx.fillStyle = g;
    pathRoundRect(x + 5, y + 4, iw, barH - 8, 4);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `900 12px ${HUD_FF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = hpNow <= 0 ? "★" : String(hpNow);
  const ty = y - 5;
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#fff";
  ctx.strokeText(label, centerX, ty);
  ctx.fillText(label, centerX, ty);
  ctx.restore();
}

function loadGeneratedTankSprites(onReady: () => void): void {
  const entries = Object.entries(GENERATED_TANK_SPRITES) as Array<
    [GeneratedTankSpriteKey, GeneratedTankSpriteDef]
  >;
  let left = entries.length;
  if (!left) {
    onReady();
    return;
  }

  const done = () => {
    left -= 1;
    if (left === 0) onReady();
  };

  for (const [key, def] of entries) {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => {
      generatedTankImages[key] = im;
      done();
    };
    im.onerror = () => {
      console.warn(`Panzer-Artillerie: generierter Panzer-Sprite konnte nicht geladen werden: ${key}`);
      done();
    };
    im.src = def.src;
  }
}

function loadSpritesheet(onReady: () => void): void {
  const im = new Image();
  im.decoding = "async";
  im.onload = () => {
    spriteSheet = im;
    loadGeneratedTankSprites(onReady);
  };
  im.onerror = () => {
    console.warn("Panzer-Artillerie: Kenney-Bogen konnte nicht geladen werden.");
    loadGeneratedTankSprites(onReady);
  };
  im.src = SPRITESHEET_REL;
}

function resizeLobbyTankCanvas(cssW: number, cssH: number): void {
  if (!lobbyTankCv || !lobbyTankCx) return;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const bw = Math.max(32, Math.floor(cssW * dpr));
  const bh = Math.max(32, Math.floor(cssH * dpr));
  if (bw !== lobbyTankCv.width || bh !== lobbyTankCv.height) {
    lobbyTankCv.width = bw;
    lobbyTankCv.height = bh;
  }
  lobbyTankCx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resolveLobbyShowcaseHero(heroIdOverride?: PlayerTankId | null): PlayerTankDef {
  if (heroIdOverride != null) {
    const d = getPlayerTankDef(heroIdOverride);
    if (d) return d;
  }
  return activeTankDef();
}

/** Gemeinsame „Bühne“ für Lobby-Showcase und Shop/Locker-Vorschau. */
function paintLobbyShowcaseIntoContext(
  L: CanvasRenderingContext2D,
  timeMs: number,
  wCss: number,
  hCss: number,
  heroDef: PlayerTankDef,
  opts?: { shopPreviewLite?: boolean },
): void {
  if (!spriteSheet || spriteSheet.naturalWidth < 16) return;
  const lite = opts?.shopPreviewLite === true;

  const grd = L.createLinearGradient(0, 0, wCss * 0.45, hCss * 1.05);
  grd.addColorStop(0, "#3730a3");
  grd.addColorStop(0.42, "#4c1d95");
  grd.addColorStop(1, "#0f172a");
  L.fillStyle = grd;
  L.fillRect(0, 0, wCss, hCss);

  if (!lite) {
    const spot = L.createRadialGradient(
      wCss * 0.56,
      hCss * 0.38,
      28,
      wCss * 0.52,
      hCss * 0.62,
      Math.max(wCss, hCss) * 0.78,
    );
    spot.addColorStop(0, "rgba(216, 180, 254, 0.55)");
    spot.addColorStop(0.42, "rgba(124, 58, 237, 0.2)");
    spot.addColorStop(1, "rgba(15, 23, 42, 0)");
    L.fillStyle = spot;
    L.fillRect(0, 0, wCss, hCss);
  }

  const floorY = hCss * 0.85;

  L.save();
  L.translate(wCss * 0.5, floorY + 22);
  L.scale(1, 0.19);
  L.beginPath();
  L.ellipse(0, 0, wCss * 0.39, 100, 0, 0, Math.PI * 2);
  const pg = L.createRadialGradient(0, 0, 30, 0, 0, wCss * 0.45);
  pg.addColorStop(0, lite ? "rgba(52, 211, 153, 0.22)" : "rgba(52, 211, 153, 0.42)");
  pg.addColorStop(0.72, "rgba(30, 27, 75, 0.35)");
  pg.addColorStop(1, "rgba(15, 23, 42, 0.2)");
  L.fillStyle = pg;
  L.fill();
  L.restore();

  L.save();
  L.translate(wCss * 0.5, floorY + 6);
  L.scale(1, 0.16);
  L.beginPath();
  L.ellipse(0, 0, wCss * 0.3, 70, 0, 0, Math.PI * 2);
  L.fillStyle = "rgba(15,23,42,0.62)";
  L.fill();
  L.restore();

  if (!lite) {
    const activeId = heroDef.id;
    const convoy = PLAYER_TANKS.filter((tank) => tank.id !== activeId).slice(-3);
    for (let i = 0; i < convoy.length; i++) {
      const def = convoy[i]!;
      const miniRect = ATLAS[def.atlasSprite];
      const lane = i - 1;
      const drift = ((timeMs * (0.018 + i * 0.004) + i * 180) % (wCss + 260)) - 130;
      const miniY = floorY - 6 + lane * 14 + Math.sin(timeMs * 0.0024 + i) * 2.4;

      L.save();
      L.globalAlpha = 0.34 + i * 0.07;
      L.translate(drift, miniY);
      L.rotate(Math.sin(timeMs * 0.0016 + i) * 0.035);
      const key = customSpriteKeyForTank(def);
      const desiredFacingRight = i % 2 !== 0;
      const drawn =
        key != null &&
        drawGeneratedTankSpriteLocal(
          L,
          key,
          def.id,
          0,
          desiredFacingRight,
          timeMs,
          0.55,
          0.45,
        );
      if (!drawn) {
        const miniW = Math.min(wCss * 0.17, miniRect.w * 1.08);
        const miniSc = miniW / miniRect.w;
        const miniDw = miniRect.w * miniSc;
        const miniDh = miniRect.h * miniSc;
        if (!desiredFacingRight) L.scale(-1, 1);
        L.drawImage(spriteSheet, miniRect.x, miniRect.y, miniRect.w, miniRect.h, -miniDw / 2, -miniDh, miniDw, miniDh);
      }
      L.restore();
    }
  }

  const rect = ATLAS[heroDef.atlasSprite];
  const sway = Math.sin(timeMs * 0.00082) * (lite ? 0.028 : 0.068);
  const bob = Math.sin(timeMs * 0.002) * (lite ? 1.5 : 4);
  const heroFx = lite ? 0 : 1.35;
  const targetWpx = Math.min(
    wCss * (lite ? 0.32 : 0.44),
    rect.w * (lite ? 2.0 : 2.75),
    lite ? Math.min(148, hCss * 0.62) : Number.POSITIVE_INFINITY,
  );
  const sc = targetWpx / rect.w;
  const dw = rect.w * sc;
  const dh = rect.h * sc;
  const cx = wCss * 0.5;
  const groundY = floorY + bob;

  L.save();
  L.translate(cx, groundY);
  L.rotate(sway);
  const activeKey = customSpriteKeyForTank(heroDef);
  const drawnActive =
    activeKey != null &&
    drawGeneratedTankSpriteLocal(
      L,
      activeKey,
      heroDef.id,
      0,
      true,
      timeMs,
      Math.max(lite ? 1.0 : 1.55, targetWpx / GENERATED_TANK_SPRITES[activeKey].targetW),
      heroFx,
    );
  if (!drawnActive) {
    drawTankVisualFxLocal(L, heroDef.id, dw, dh, timeMs, heroFx);
    L.drawImage(spriteSheet, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
  }
  L.restore();

  if (!lite) {
    const vigTop = L.createLinearGradient(0, 0, 0, hCss * 0.52);
    vigTop.addColorStop(0, "rgba(15,23,42,0.58)");
    vigTop.addColorStop(1, "rgba(15,23,42,0)");
    L.fillStyle = vigTop;
    L.fillRect(0, 0, wCss, hCss * 0.52);

    const vigEdge = L.createRadialGradient(wCss / 2, hCss / 2, hCss * 0.35, wCss / 2, hCss / 2, Math.max(wCss, hCss) * 0.74);
    vigEdge.addColorStop(0, "rgba(0,0,0,0)");
    vigEdge.addColorStop(1, "rgba(0,0,0,0.5)");
    L.fillStyle = vigEdge;
    L.fillRect(0, 0, wCss, hCss);
  } else {
    L.fillStyle = "rgba(15,23,42,0.35)";
    L.fillRect(0, 0, wCss, hCss * 0.22);
  }
}

/** Lobby-Hintergrund + großer Panzer wie in Fortnite „Showcase“. */
function paintLobbyTankScene(timeMs: number, wCss: number, hCss: number): void {
  if (!lobbyTankCx || !spriteSheet || spriteSheet.naturalWidth < 16) return;
  resizeLobbyTankCanvas(wCss, hCss);
  paintLobbyShowcaseIntoContext(lobbyTankCx, timeMs, wCss, hCss, activeTankDef());
}

function syncHubTankPreviewHints(): void {
  const id = hubShopLockerPreviewTankId ?? readEquippedTankId();
  const def = getPlayerTankDef(id);
  const shopEl = document.getElementById("taShopTankPreviewHint");
  const lockerEl = document.getElementById("taLockerTankPreviewHint");
  if (!def) {
    if (shopEl) shopEl.textContent = "";
    if (lockerEl) lockerEl.textContent = "";
    return;
  }
  let shopLine = `Vorschau: ${def.nameDe}`;
  if (def.priceGems <= 0) shopLine += " · Starter";
  else if (readOwnedTankIds().includes(def.id)) shopLine += " · bereits gekauft";
  else shopLine += ` · ${def.priceGems} 💎`;
  let lockerLine = `Vorschau: ${def.nameDe}`;
  if (def.priceGems <= 0) lockerLine += " · Starter";
  else if (readOwnedTankIds().includes(def.id)) lockerLine += " · in der Garage";
  else lockerLine += ` · noch im Shop (${def.priceGems} 💎)`;
  if (shopEl) shopEl.textContent = shopLine;
  if (lockerEl) lockerEl.textContent = lockerLine;
}

function resizeHubPreviewCanvas(cv: HTMLCanvasElement, cssW: number, cssH: number): void {
  const dpr = 1;
  const bw = Math.max(32, Math.floor(cssW * dpr));
  const bh = Math.max(32, Math.floor(cssH * dpr));
  if (cv.width !== bw || cv.height !== bh) {
    cv.width = bw;
    cv.height = bh;
  }
  const cx = cv.getContext("2d");
  if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function hubPreviewFrame(now: number): void {
  if (!shopOverlayOpen() && !lockerOverlayOpen()) {
    hubPreviewAnim = 0;
    return;
  }
  const id = hubShopLockerPreviewTankId ?? readEquippedTankId();
  const hero = resolveLobbyShowcaseHero(id);
  const cv = shopOverlayOpen()
    ? (document.getElementById("taShopTankPreviewCanvas") as HTMLCanvasElement | null)
    : (document.getElementById("taLockerTankPreviewCanvas") as HTMLCanvasElement | null);
  const wrap = cv?.parentElement;
  if (cv && wrap && spriteSheet && spriteSheet.naturalWidth >= 16) {
    const wCss = Math.max(160, wrap.clientWidth | 0);
    const hCss = Math.max(130, Math.min(220, wCss * 0.5));
    resizeHubPreviewCanvas(cv, wCss, hCss);
    const ctx = cv.getContext("2d");
    const paintDue =
      hubPreviewPaintUrgent || now - hubPreviewLastPaintMs >= HUB_PREVIEW_FRAME_INTERVAL_MS;
    if (ctx && paintDue) {
      hubPreviewPaintUrgent = false;
      hubPreviewLastPaintMs = now;
      paintLobbyShowcaseIntoContext(ctx, now, wCss, hCss, hero, { shopPreviewLite: true });
    }
  }
  hubPreviewAnim = requestAnimationFrame(hubPreviewFrame);
}

function startHubPreviewLoop(): void {
  hubPreviewPaintUrgent = true;
  if (hubPreviewAnim !== 0) return;
  hubPreviewAnim = requestAnimationFrame(hubPreviewFrame);
}

function stopHubPreviewLoop(): void {
  if (hubPreviewAnim !== 0) {
    cancelAnimationFrame(hubPreviewAnim);
    hubPreviewAnim = 0;
  }
}

function lobbyTankFrame(now: number): void {
  const hub = document.getElementById("taHub");
  const lobbyPanel = document.getElementById("taHubPanelLobby");
  if (!hub || hub.hidden || !lobbyPanel || lobbyPanel.hidden) {
    lobbyTankAnim = 0;
    return;
  }
  const wrap = document.querySelector(".taLobbyShowcase");
  if (!(wrap instanceof HTMLElement) || !lobbyTankCv) {
    lobbyTankAnim = 0;
    return;
  }
  const wCss = Math.max(16, wrap.clientWidth | 0);
  const hCss = Math.max(16, wrap.clientHeight | 0);
  paintLobbyTankScene(now, wCss, hCss);
  lobbyTankAnim = requestAnimationFrame(lobbyTankFrame);
}

function startLobbyTankShowcase(): void {
  if (lobbyTankAnim !== 0) cancelAnimationFrame(lobbyTankAnim);
  lobbyTankAnim = requestAnimationFrame(lobbyTankFrame);
}

function stopLobbyTankShowcase(): void {
  if (lobbyTankAnim !== 0) {
    cancelAnimationFrame(lobbyTankAnim);
    lobbyTankAnim = 0;
  }
}

function gy(x: number): number {
  return heightAt(T, x);
}

/** Unterkante des Panzers: höchsten Boden unter Ketten-Spur (über welliges Terrain keine „Luft-Unter-Schienen«). */
const HULL_FOOTPRINT_HALF = 44;
const HULL_POSE_MAX_SLOPE_RAD = Math.PI / 7.2;
const HULL_DRIVE_MAX_RAW_SLOPE_RAD = Math.PI / 4.2;
const HULL_DRIVE_MAX_CLEARANCE_PX = 48;

function hullClampX(cx: number): number {
  return Math.max(2, Math.min(worldW - 3, cx));
}

function hullPose(tx: number): ReturnType<typeof terrainHullPose> {
  return terrainHullPose(T, hullClampX(tx), HULL_FOOTPRINT_HALF, {
    maxSlopeRad: HULL_POSE_MAX_SLOPE_RAD,
    sampleCount: 11,
  });
}

function hullGroundY(tx: number): number {
  return hullPose(tx).groundY;
}

function hullSlope(tx: number): number {
  return hullPose(tx).slope;
}

function tankSurfaceDriveable(tx: number): boolean {
  const p = hullPose(tx);
  return (
    Math.abs(p.rawSlope) <= HULL_DRIVE_MAX_RAW_SLOPE_RAD &&
    p.maxClearancePx <= HULL_DRIVE_MAX_CLEARANCE_PX
  );
}

function findStableTankX(preferredX: number, otherX: number): number {
  const base = sx(preferredX, otherX);
  if (tankSurfaceDriveable(base)) return base;
  for (let radius = 10; radius <= 260; radius += 10) {
    const left = sx(preferredX - radius, otherX);
    if (tankSurfaceDriveable(left)) return left;
    const right = sx(preferredX + radius, otherX);
    if (tankSurfaceDriveable(right)) return right;
  }
  return base;
}

function movePlayerTank(deltaX: number): boolean {
  const candidate = sx(px + deltaX, bx);
  if (candidate === px || !tankSurfaceDriveable(candidate)) return false;
  px = candidate;
  playerTankMotionUntil = performance.now() + 260;
  spawnDriveTrailForMove(deltaX);
  return true;
}

function pv(tx: number): number {
  return hullGroundY(tx) - 36;
}
/** Rohrlänge (Welt-Px) — gleiche Strecke wie in `muzzleAt`, damit Geschoss an der Mündung startet. */
const BARREL_LEN_PX = 61;

function playerBarrelLosBlocked(): boolean {
  return terrainBlocksBarrelRay(T, px, pv(px), ang, true, BARREL_LEN_PX);
}

function muzzleAt(tx: number, L: boolean, deg: number): { x: number; y: number } {
  const r = Math.max(13, Math.min(88, deg)) * (Math.PI / 180);
  const l = BARREL_LEN_PX;
  return { x: tx + Math.cos(r) * l * (L ? 1 : -1), y: pv(tx) - Math.sin(r) * l };
}

/** Turm-Drehpunkt (Nähe Kanonenbasis) — Rohr-Linie Pivot → Mündung. */
function hullPivot(tx: number): { x: number; y: number } {
  return { x: tx, y: pv(tx) };
}
function mP(tx: number, L: boolean): { x: number; y: number } {
  return muzzleAt(tx, L, ang);
}
function mB(tx: number, L: boolean, d: number): { x: number; y: number } {
  return muzzleAt(tx, L, d);
}

/** Grobe Rohr-Richtung Richtung Gegner (Fahrphase: Rohr folgt langsam) */
function roughBotAimTowardPlayerDeg(): number {
  const mu = muzzleAt(bx, false, enemyBarrelVisDeg);
  const ty = pv(px) - 28;
  const dx = px - mu.x;
  const dy = ty - mu.y;
  const deg = Math.atan2(-dy, dx) * (180 / Math.PI);
  return Math.max(22, Math.min(80, deg));
}

function tickEnemyBarrelVis(): void {
  if (enemyBarrelRecoilDeg > 0.035) enemyBarrelRecoilDeg *= 0.86;
  else enemyBarrelRecoilDeg = 0;
  if (hpB <= 0) return;
  const tgt = ph === "bf" ? bθ : roughBotAimTowardPlayerDeg();
  let stiffness = 0.22;
  let damping = 0.7;
  if (ph === "bf") {
    stiffness = 0.48;
    damping = 0.66;
  } else if (ph === "m" || ph === "bw") {
    stiffness = 0.2;
    damping = 0.72;
  } else if (ph === "aim" || ph === "pf") {
    stiffness = 0.16;
    damping = 0.76;
  }
  enemyBarrelVel = (enemyBarrelVel + (tgt - enemyBarrelVisDeg) * stiffness) * damping;
  enemyBarrelVisDeg += enemyBarrelVel;
  if (Math.abs(tgt - enemyBarrelVisDeg) < 0.07 && Math.abs(enemyBarrelVel) < 0.09) {
    enemyBarrelVisDeg = tgt;
    enemyBarrelVel = 0;
  }
  enemyBarrelVisDeg = Math.max(16, Math.min(88, enemyBarrelVisDeg));
}

function roughEnemyAimHintDeg(): number {
  const mu = muzzleAt(px, true, barrelVisAng);
  const tx = bx;
  const ty = pv(bx) - 28;
  const dx = tx - mu.x;
  const dy = ty - mu.y;
  const deg = Math.atan2(-dy, dx) * (180 / Math.PI);
  return Math.max(22, Math.min(80, deg));
}

function tickBarrelVis(): void {
  if (barrelRecoilDeg > 0.035) barrelRecoilDeg *= 0.86;
  else barrelRecoilDeg = 0;

  if (ph === "aim" && isBlitzSlot(selectedSlot)) {
    barrelVisVel *= 0.8;
    if (Math.abs(barrelVisVel) < 0.02) barrelVisVel = 0;
    return;
  }

  let tgt = ang;
  if (ph === "m") tgt = roughEnemyAimHintDeg();

  let stiffness = 0.18;
  let damping = 0.76;
  if (ph === "m") {
    stiffness = 0.24;
    damping = 0.7;
  } else if (ph === "aim") {
    stiffness = 0.44;
    damping = 0.64;
  } else if (ph === "pf") {
    stiffness = 0.32;
    damping = 0.68;
  }

  barrelVisVel = (barrelVisVel + (tgt - barrelVisAng) * stiffness) * damping;
  barrelVisAng += barrelVisVel;
  if (Math.abs(tgt - barrelVisAng) < 0.08 && Math.abs(barrelVisVel) < 0.1) {
    barrelVisAng = tgt;
    barrelVisVel = 0;
  }
  barrelVisAng = Math.max(12, Math.min(92, barrelVisAng));
}
function sx(c: number, o: number): number {
  const lo = TANK_HALF_W + 130;
  const hi = worldW - TANK_HALF_W - 130;
  const minGap = Math.min(520, worldW * 0.32);
  let z = Math.max(lo, Math.min(hi, c));
  let i = 0;
  while (i++ < 52 && Math.abs(z - o) < minGap) z += z < o ? -92 : 92;
  return Math.max(lo, Math.min(hi, z));
}

function clampCamX(x: number): number {
  return Math.max(0, Math.min(Math.max(0, worldW - VIEW_W), x));
}

function tickCamera(): void {
  if (worldW <= VIEW_W + 1) {
    camX = 0;
    return;
  }
  if (mapDifficulty === "insane") {
    /** Insane: Kamera bleibt fix, damit beide Panzer links/rechts sichtbar bleiben. */
    return;
  }
  /** Tanks sollen wie früher immer sichtbar bleiben: Kamera folgt dem Mittelpunkt zwischen beiden. */
  const mid = (px + bx) / 2;
  const tgt = clampCamX(mid - VIEW_W * 0.5);
  camX += (tgt - camX) * 0.08;
  if (Math.abs(tgt - camX) < 0.25) camX = tgt;
}
function flightPath(
  mu: { x: number; y: number },
  vx: number,
  vy: number,
  dragMul = 1,
): Array<{ x: number; y: number }> {
  return sampleTrajectory(T, mu.x, mu.y, vx, vy, wa, FLIGHT_MAX_PTS, FLIGHT_DT, dragMul);
}

function applyDamageToPlayerRounded(rawRounded: number): void {
  let d = Math.max(0, rawRounded);
  if (d <= 0) return;
  const absorbed = Math.min(playerShieldAbsorb, d);
  playerShieldAbsorb -= absorbed;
  if (absorbed > 0) {
    shieldImpactUntil = performance.now() + 520;
    shieldImpactAbsorbed = absorbed;
  }
  d -= absorbed;
  hpP -= d;
  hpP = Math.max(0, hpP);
}

/** Treffer: Krater + Splash + Bildschirm-Wackeln + später Einschlag-Animation. */
function spl(ix: number, iy: number, W: WeaponDef): void {
  applyCrater(T, ix, W.craterPx, W.craterLift);
  applyDamageToPlayerRounded(
    Math.round(splashDamage(ix, iy, px, hullGroundY(px), TANK_HALF_W, TANK_HALF_H, W.splashPx, W.dmg)),
  );
  hpB -= Math.round(
    splashDamage(ix, iy, bx, hullGroundY(bx), TANK_HALF_W, TANK_HALF_H, W.splashPx, W.dmg) * playerDamageMulVersusBot(),
  );
  hpB = Math.max(0, hpB);
  const sty = impactFxStyle(W);
  const splashVis =
    sty === "dust"
      ? W.splashPx * 2.05
      : sty === "pellet"
        ? W.splashPx * 1.52
        : sty === "poison"
          ? W.splashPx * 1.95
          : W.splashPx;
  pushImpactBurst({
    x: ix,
    y: iy + 2,
    t0: performance.now(),
    splash: splashVis,
    style: sty === "default" ? undefined : sty,
  });
  shakeUntil = performance.now() + 260;
}

function shakeOffset(now: number): { x: number; y: number } {
  if (now >= shakeUntil) return { x: 0, y: 0 };
  const amp = Math.max(0.4, ((shakeUntil - now) / 260) * 9);
  return { x: (roll() - 0.5) * amp * 2, y: (roll() - 0.45) * amp * 2 };
}

function drawSingleImpactBurst(now: number, b: ImpactBurstFx): void {
  const age = now - b.t0;
  const maxAge = maxImpactBurstAgeMs(b.style);
  if (age > maxAge || age < 0) return;

  const { x, y, splash } = b;
  const sty = b.style ?? "default";
  const ez = sty === "electric";
  const du = sty === "dust";
  const toxic = sty === "poison";
  const pl = sty === "pellet";
  const dustLike = du || toxic;
  const k = age / maxAge;
  ctx.save();

  const nRings = dustLike ? 4 : pl ? 4 : 3;
  const ringBoost = dustLike ? 1.12 : pl ? 1.06 : 1;
  for (let r = 0; r < nRings; r++) {
    const kk = Math.max(0, k - r * (dustLike ? 0.06 : 0.08));
    if (kk <= 0) continue;
    const R = splash * ringBoost * (0.52 + kk * (dustLike ? 2.05 : 1.75));
    ctx.globalAlpha = (1 - kk) * (dustLike ? 0.82 : pl ? 0.78 : 0.72) - r * (dustLike ? 0.12 : 0.18);
    ctx.lineWidth = (dustLike ? 6.5 : pl ? 5.5 : 5) - r * (dustLike ? 1.1 : 1);
    if (ez) {
      ctx.strokeStyle = r === 0 ? "#93c5fd" : r === 1 ? "#38bdf8" : "#0ea5e9";
    } else if (toxic) {
      ctx.strokeStyle = r === 0 ? "#86efac" : r === 1 ? "#4ade80" : r === 2 ? "#22c55e" : "#14532d";
    } else if (du) {
      ctx.strokeStyle = r === 0 ? "#fbbf24" : r === 1 ? "#f59e0b" : r === 2 ? "#d97706" : "#fcd34d";
    } else if (pl) {
      ctx.strokeStyle = r === 0 ? "#fde047" : r === 1 ? "#fdba74" : r === 2 ? "#f97316" : "#fcd34d";
    } else {
      ctx.strokeStyle = r === 0 ? "#fde047" : r === 1 ? "#fb923c" : "#fcd34d";
    }
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1 - k * (dustLike ? 0.42 : 0.55);
  const rg = splash * (dustLike ? 1.06 : 0.95);
  const g = ctx.createRadialGradient(x, y, 6, x, y, rg);
  if (ez) {
    g.addColorStop(0, "rgba(224,242,254,0.98)");
    g.addColorStop(0.42, "rgba(125,211,252,0.62)");
    g.addColorStop(0.75, "rgba(14,165,233,0.38)");
    g.addColorStop(1, "rgba(59,130,246,0)");
  } else if (toxic) {
    g.addColorStop(0, "rgba(220,252,231,0.96)");
    g.addColorStop(0.38, "rgba(74,222,128,0.72)");
    g.addColorStop(0.72, "rgba(22,101,52,0.42)");
    g.addColorStop(1, "rgba(20,83,45,0)");
  } else if (du) {
    g.addColorStop(0, "rgba(254,252,232,0.96)");
    g.addColorStop(0.38, "rgba(251,191,36,0.72)");
    g.addColorStop(0.72, "rgba(180,83,9,0.38)");
    g.addColorStop(1, "rgba(120,53,15,0)");
  } else if (pl) {
    g.addColorStop(0, "rgba(255,251,235,0.96)");
    g.addColorStop(0.42, "rgba(253,224,71,0.62)");
    g.addColorStop(0.75, "rgba(249,115,22,0.28)");
    g.addColorStop(1, "rgba(239,68,68,0)");
  } else {
    g.addColorStop(0, "rgba(255,255,230,0.95)");
    g.addColorStop(0.42, "rgba(253,224,71,0.55)");
    g.addColorStop(0.75, "rgba(249,115,22,0.22)");
    g.addColorStop(1, "rgba(239,68,68,0)");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, splash * (dustLike ? 1.02 : 0.9) + k * splash * (dustLike ? 0.76 : 0.65), 0, Math.PI * 2);
  ctx.fill();

  if (dustLike) {
    const upBias = -Math.PI / 2;
    const dustPhase = x * 0.0097 + y * 0.0113;
    for (let w = 0; w < 5; w++) {
      const rot = dustPhase + w * 1.17 + k * 2.1;
      const rx = splash * (0.55 + w * 0.22 + k * 0.95);
      const ry = splash * (0.18 + w * 0.05 + k * 0.38);
      ctx.globalAlpha = (1 - k) * (0.35 - w * 0.05);
      ctx.fillStyle = toxic
        ? w % 2 === 0
          ? "rgba(187,247,208,0.58)"
          : "rgba(22,101,52,0.4)"
        : w % 2 === 0
          ? "rgba(254,243,199,0.55)"
          : "rgba(217,119,6,0.32)";
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(upBias + rot * 0.35) * splash * 0.12,
        y + Math.sin(upBias) * splash * (0.18 + k * 0.55 + w * 0.08),
        rx,
        ry,
        rot,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const nSpark = dustLike ? 48 : pl ? 36 : 22;
  const sparkSpread = k;
  for (let i = 0; i < nSpark; i++) {
    let a: number;
    let radial: number;
    if (dustLike) {
      const fan = Math.PI * 1.55;
      a = -Math.PI / 2 + (i / Math.max(1, nSpark - 1) - 0.5) * fan + Math.sin(k * 4 + i * 0.31) * 0.35;
      radial = splash * (0.42 + ((i * 29) % 7) * 0.07) * (0.85 + sparkSpread * 1.05);
    } else {
      a = ((i / nSpark) * Math.PI * 2 + k * 3.9 + i * 7.71) % (Math.PI * 2);
      radial = splash * (0.35 + (i % 5) * 0.06) * sparkSpread;
      if (pl) radial *= 1.08;
    }
    const sx = x + Math.cos(a) * radial * 1.05;
    const sy = y + Math.sin(a) * radial * (dustLike ? 1.08 : 0.85) + sparkSpread * splash * (dustLike ? 0.2 : 0.12);
    ctx.globalAlpha = (1 - k) * (dustLike ? 0.62 : pl ? 0.55 : 0.5) * (0.65 + roll() * 0.35);
    if (ez) {
      ctx.fillStyle = i % 2 === 0 ? "#dbeafe" : "#e0f2fe";
    } else if (toxic) {
      ctx.fillStyle = i % 3 === 0 ? "#dcfce7" : i % 3 === 1 ? "#86efac" : "rgba(21,128,61,0.88)";
    } else if (du) {
      ctx.fillStyle =
        i % 3 === 0 ? "#fef3c7" : i % 3 === 1 ? "#fde68a" : "rgba(180,83,9,0.85)";
    } else if (pl) {
      ctx.fillStyle = i % 2 === 0 ? "#fffbeb" : "#fed7aa";
    } else {
      ctx.fillStyle = i % 2 === 0 ? "#fff7ed" : "#fed7aa";
    }
    ctx.strokeStyle = "rgba(15,23,42,0.35)";
    ctx.lineWidth = dustLike || pl ? 1.55 : 1.25;
    const pr = (dustLike ? 2.85 : pl ? 2.6 : 2.2) + sparkSpread * (dustLike ? 6.2 : pl ? 5.5 : 5);
    ctx.beginPath();
    ctx.arc(sx, sy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawImpactBurstLayer(now: number): void {
  impactBursts = impactBursts.filter((b) => now - b.t0 <= maxImpactBurstAgeMs(b.style));
  for (const b of impactBursts) drawSingleImpactBurst(now, b);
}

function drawRadialMuzzle(mu: { x: number; y: number }, radGun: number, flip: boolean): void {
  ctx.save();
  ctx.translate(mu.x, mu.y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(-radGun);
  const gx = ctx.createRadialGradient(0, 0, 2, 22, -2, 55);
  gx.addColorStop(0, "rgba(255,255,230,1)");
  gx.addColorStop(0.32, "rgba(254,249,195,0.95)");
  gx.addColorStop(0.62, "rgba(251,191,36,0.6)");
  gx.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = gx;
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.moveTo(44, -18);
  ctx.lineTo(96, -4);
  ctx.lineTo(96, 6);
  ctx.lineTo(44, 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,237,148,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawMuzzleFlashes(now: number): void {
  const radGun = (d: number) => (Math.max(13, Math.min(88, d)) * Math.PI) / 180;
  const fadeMs = 300;
  if (now < muzzleExpire && ph === "pf") {
    const t = Math.max(0, 1 - (muzzleExpire - now) / fadeMs);
    const vis = barrelVisAng + barrelRecoilDeg;
    const mu = muzzleAt(px, true, vis);
    ctx.save();
    ctx.globalAlpha = 0.92 * (t < 0.25 ? t * 4 : Math.max(0, 2.2 - t * 1.8));
    drawRadialMuzzle(mu, radGun(vis), false);
    ctx.restore();
  }
  if (now < botMuzzleExpire && ph === "bf") {
    const t = Math.max(0, 1 - (botMuzzleExpire - now) / 290);
    const visB = enemyBarrelVisDeg + enemyBarrelRecoilDeg;
    const mu = muzzleAt(bx, false, visB);
    ctx.save();
    ctx.globalAlpha = 0.94 * (t < 0.22 ? t * 4.5 : Math.max(0, 2.05 - t * 1.9));
    drawRadialMuzzle(mu, radGun(visB), true);
    ctx.restore();
  }
}

/** Verlässt Kampfphasen ohne Neustart: kein Geschoss/Partikel mehr, kein „halb im Flug“. */
function abortActiveCombatFlightState(): void {
  ph = "m";
  tr = [];
  ti = 0;
  playerPelletFlights = null;
  projectileInFlightStyle = null;
  impactBursts = [];
  muzzleExpire = 0;
  botMuzzleExpire = 0;
  barrelRecoilDeg = 0;
  enemyBarrelRecoilDeg = 0;
  barrelVisVel = 0;
  enemyBarrelVel = 0;
  playerTankMotionUntil = 0;
  barrelBlockedHintUntil = 0;
  shakeUntil = 0;
  shieldImpactUntil = 0;
  shieldImpactAbsorbed = 0;
  lightningBolt = null;
  lightningBannerUntil = 0;
  lightningBannerLines = [];
  shieldBannerUntil = 0;
  shieldBannerLines = [];
  bwI = 0;
  bWait = 0;
  surrenderStep = 0;
  clearDriveTrailParticles();
}

function begin(): void {
  rngSeed = (seed ^ 200_003) >>> 0;
  mapBattleTheme = readMapBattleTheme();
  /** Testspiel: immer normale Welt (kein Insane‑Chaos / keine Extra‑Breite). Echter Modus bleibt im Speicher. */
  mapDifficulty = battleTestModeActive() ? "normal" : readMapDifficulty();
  worldW = mapDifficulty === "insane" ? Math.max(VIEW_W, Math.floor(VIEW_W * 2.08)) : VIEW_W;
  T = buildTerrain(seed, { difficulty: mapDifficulty, width: worldW });
  seed = (seed ^ 104_793) >>> 0;
  resetMatchRound();
}

function resetMatchRound(): void {
  kampfNr += 1;
  blitzConsumedThisMatch = false;
  playerShieldAbsorb = 0;
  shieldBannerUntil = 0;
  shieldBannerLines = [];
  if (blitzWaveUnlockedForCurrentMatch()) {
    blitzBuddyDe = BLITZ_BUDDY_NAMES_DE[Math.floor(roll() * BLITZ_BUDDY_NAMES_DE.length)]!;
  } else {
    blitzBuddyDe = "";
  }
  enemyTankSkin = pickEnemyTankSkin();
  wa = (roll() - 0.5) * 64;
  battleMaxHp = activeTankDef().maxHp;
  hpP = battleMaxHp;
  hpB = battleMaxHp;
  if (mapDifficulty === "insane") {
    camX = clampCamX((worldW - VIEW_W) / 2);
    px = sx(camX + VIEW_W * 0.145 + roll() * VIEW_W * 0.05, camX + VIEW_W / 2);
    bx = sx(camX + VIEW_W * 0.855 - roll() * VIEW_W * 0.05, camX + VIEW_W / 2);
  } else {
    camX = 0;
    px = sx(VIEW_W * 0.145 + roll() * VIEW_W * 0.05, VIEW_W / 2);
    bx = sx(VIEW_W * 0.855 - roll() * VIEW_W * 0.05, VIEW_W / 2);
  }
  px = findStableTankX(px, bx);
  bx = findStableTankX(bx, px);
  ang = 50 + Math.floor(seed % 22);
  barrelVisAng = ang;
  pow = 520 + Math.floor(seed % 180);
  selectedSlot = seed % 3;
  const cap = playerFuelCapacity();
  fuelP = cap;
  fuelB = Math.floor(cap * 0.9);
  ph = "m";
  tr = [];
  playerPelletFlights = null;
  ti = 0;
  impactBursts = [];
  muzzleExpire = 0;
  botMuzzleExpire = 0;
  barrelRecoilDeg = 0;
  enemyBarrelRecoilDeg = 0;
  barrelVisVel = 0;
  enemyBarrelVel = 0;
  playerTankMotionUntil = 0;
  barrelBlockedHintUntil = 0;
  shakeUntil = 0;
  shieldImpactUntil = 0;
  shieldImpactAbsorbed = 0;
  surrenderStep = 0;
  matchResult = null;
  lightningBolt = null;
  lightningBannerUntil = 0;
  lightningBannerLines = [];
  blitzStrikeX = mapDifficulty === "insane" ? camX + VIEW_W * 0.52 : worldW * 0.52;
  enemyBarrelVisDeg = bθ;
  if (mapDifficulty !== "insane") camX = clampCamX((px + bx) / 2 - VIEW_W * 0.5);
  clearDriveTrailParticles();
}

function buildBoltOffsets(len: number): number[] {
  const o: number[] = [];
  for (let i = 0; i < len; i++) {
    const t = 1 - Math.min(i, len - i) / (len * 0.9);
    o.push((roll() - 0.52) * 58 * t);
  }
  return o;
}

/** Ein Ableiter von oben — Horizontal mit A/D / Klick, Krater und Splash wie Direkttreffer */
function applySkyBolt(nowMs: number): void {
  clampBlitzAim();
  const ix = Math.round(blitzStrikeX);
  const iy = heightAt(T, ix);
  const mul = activeTankDef().blitzMul;

  applyCrater(T, ix, LIGHTNING_CRATER_PX, LIGHTNING_CRATER_DEPTH);
  applyDamageToPlayerRounded(
    Math.round(
      splashDamage(ix, iy, px, hullGroundY(px), TANK_HALF_W, TANK_HALF_H, BLITZ_SPLASH_PX, LIGHTNING_DAMAGE * mul),
    ),
  );
  hpB -= Math.round(
    splashDamage(ix, iy, bx, hullGroundY(bx), TANK_HALF_W, TANK_HALF_H, BLITZ_SPLASH_PX, LIGHTNING_DAMAGE * mul) *
      playerDamageMulVersusBot(),
  );
  hpB = Math.max(0, hpB);

  const jagLen = 20;
  const jagA = buildBoltOffsets(jagLen).map((v) => v - 22);
  const jagB = buildBoltOffsets(jagLen).map((v) => v + 22);

  pushImpactBurst({
    x: ix,
    y: iy + 2,
    t0: nowMs,
    splash: Math.min(236, LIGHTNING_CRATER_PX * 0.68),
    style: "electric",
  });
  lightningBolt = { t0: nowMs, cx: ix, gy: iy, jagA, jagB };
  shakeUntil = nowMs + 420;

  lightningBannerUntil = nowMs + 2680;
  blitzConsumedThisMatch = true;
  lightningBannerLines = [
    "BLITZ!",
    blitzBuddyDe ? `${blitzBuddyDe} · Unterstützung von oben` : "Luftschlag von oben",
  ];
}

function cacheDefaultLobbyLeadShort(): void {
  const el = document.getElementById("taLobbyLeadShort");
  const t = el?.textContent?.trim();
  if (t) defaultLobbyLeadShort = t;
}

let mapPrefsWired = false;

function syncMapPrefsUi(): void {
  const dSel = document.getElementById("taMapDifficulty") as HTMLSelectElement | null;
  const tSel = document.getElementById("taMapTheme") as HTMLSelectElement | null;
  const xp = readXp();
  if (dSel) {
    const insaneOpt = dSel.querySelector('option[value="insane"]') as HTMLOptionElement | null;
    if (insaneOpt) insaneOpt.disabled = xp < 3000;
    const cur = readMapDifficulty();
    const next = cur === "insane" && xp < 3000 ? "hard" : cur;
    if (dSel.value !== next) dSel.value = next;
    if (next !== cur) setMapDifficulty(next);
  }
  if (tSel) {
    const curT = readMapBattleTheme();
    if (tSel.value !== curT) tSel.value = curT;
  }
}

function wireMapPrefsFromLobby(): void {
  if (mapPrefsWired) return;
  mapPrefsWired = true;
  const dSel = document.getElementById("taMapDifficulty") as HTMLSelectElement | null;
  const tSel = document.getElementById("taMapTheme") as HTMLSelectElement | null;
  if (dSel) {
    dSel.addEventListener("change", () => {
      const want = dSel.value;
      if (want === "insane" && readXp() < 3000) {
        dSel.value = "hard";
        setMapDifficulty("hard");
        syncMapPrefsUi();
        return;
      }
      setMapDifficulty(want);
      syncMapPrefsUi();
    });
  }
  if (tSel) {
    tSel.addEventListener("change", () => {
      setMapBattleTheme(tSel.value);
      syncMapPrefsUi();
    });
  }
  syncMapPrefsUi();
}

function drawAirplanes(now: number): void {
  const yBase = WORLD.H * 0.14;
  const tint = mapBattleTheme === "moon" ? "rgba(226,232,240,0.62)" : "rgba(15,23,42,0.55)";
  const rim = mapBattleTheme === "moon" ? "rgba(125,211,252,0.22)" : "rgba(255,255,255,0.18)";

  const drawOne = (k: number, dir: 1 | -1): void => {
    const sp = 0.038 + k * 0.012;
    const u = (now * sp * dir) % (VIEW_W + 420);
    const x = dir === 1 ? -210 + u : VIEW_W + 210 - u;
    const y = yBase + k * 34 + Math.sin(now * (0.00065 + k * 0.00012) + k * 5.2) * (8 + k * 2.5);
    const sc = 0.78 + k * 0.18;
    ctx.save();
    ctx.translate(x, y);
    if (dir === -1) ctx.scale(-1, 1);
    ctx.scale(sc, sc);
    ctx.rotate(Math.sin(now * 0.00048 + k) * 0.08);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = tint;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Simple silhouette: fuselage + wings + tail
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(18, -2);
    ctx.quadraticCurveTo(34, 0, 18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-22, -10);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  drawOne(0, 1);
  drawOne(1, -1);
  drawOne(2, 1);
}

/** Nach Aufgeben („Weiter zur Lobby“): Purse, Showcase-Flash, Kurztext — Game-Over-Overlay bleibt bis dahin aktiv. */
function polishReturnToLobbyAfterSurrender(): void {
  refreshPurseDisplays();
  syncFortniteRail();
  collapseShopCodePanel();
  const showcase = document.querySelector(".taLobbyShowcase");
  if (showcase instanceof HTMLElement) {
    showcase.classList.remove("taLobbyShowcase--returnFlash");
    void showcase.offsetWidth;
    showcase.classList.add("taLobbyShowcase--returnFlash");
    const onDone = (): void => {
      showcase.removeEventListener("animationend", onDone);
      showcase.classList.remove("taLobbyShowcase--returnFlash");
    };
    showcase.addEventListener("animationend", onDone, { once: true });
  }
  const lead = document.getElementById("taLobbyLeadShort");
  if (lead) {
    lead.textContent =
      "Zurück in der Lobby · Der Gegner hat gewonnen · XP und 💎 unverändert · „Ins Spiel“ startet eine neue Runde.";
    window.clearTimeout(lobbyLeadResetTimer);
    lobbyLeadResetTimer = window.setTimeout(() => {
      lead.textContent = defaultLobbyLeadShort;
    }, 5500);
  }
}

/** Nach Sieg → „Zurück zur Lobby“. */
function polishReturnToLobbyAfterWin(): void {
  refreshPurseDisplays();
  syncFortniteRail();
  collapseShopCodePanel();
  const showcase = document.querySelector(".taLobbyShowcase");
  if (showcase instanceof HTMLElement) {
    showcase.classList.remove("taLobbyShowcase--returnFlash");
    void showcase.offsetWidth;
    showcase.classList.add("taLobbyShowcase--returnFlash");
    const onDone = (): void => {
      showcase.removeEventListener("animationend", onDone);
      showcase.classList.remove("taLobbyShowcase--returnFlash");
    };
    showcase.addEventListener("animationend", onDone, { once: true });
  }
  const lead = document.getElementById("taLobbyLeadShort");
  if (lead) {
    lead.textContent = "Sieg! „Ins Spiel“ startet die nächste Runde.";
    window.clearTimeout(lobbyLeadResetTimer);
    lobbyLeadResetTimer = window.setTimeout(() => {
      lead.textContent = defaultLobbyLeadShort;
    }, 5500);
  }
}

/** Nach Niederlage im Kampf → „Zurück zur Lobby“ (XP/💎 unverändert). */
function polishReturnToLobbyAfterLoss(): void {
  refreshPurseDisplays();
  syncFortniteRail();
  collapseShopCodePanel();
  const showcase = document.querySelector(".taLobbyShowcase");
  if (showcase instanceof HTMLElement) {
    showcase.classList.remove("taLobbyShowcase--returnFlash");
    void showcase.offsetWidth;
    showcase.classList.add("taLobbyShowcase--returnFlash");
    const onDone = (): void => {
      showcase.removeEventListener("animationend", onDone);
      showcase.classList.remove("taLobbyShowcase--returnFlash");
    };
    showcase.addEventListener("animationend", onDone, { once: true });
  }
  const lead = document.getElementById("taLobbyLeadShort");
  if (lead) {
    lead.textContent =
      "Zurück in der Lobby · Niederlage — XP und 💎 unverändert · „Ins Spiel“ startet die nächste Runde.";
    window.clearTimeout(lobbyLeadResetTimer);
    lobbyLeadResetTimer = window.setTimeout(() => {
      lead.textContent = defaultLobbyLeadShort;
    }, 5500);
  }
}

/** Sichtbarkeit: Test verlassen — nur während aktivem Testspiel und ohne Game-Over-Overlay. */
function syncBattleTestLeaveUi(): void {
  const row = document.getElementById("taBattleTestLeaveRow");
  if (!row) return;
  row.hidden = !(battleTestModeActive() && matchResult === null);
}

/** Testspiel sofort beenden — ohne Aufgeben-Dialog (Esc oder Button). */
function leaveBattleTestToLobby(): void {
  if (!battleTestModeActive()) return;
  closeSurrenderDialog(false);
  abortActiveCombatFlightState();
  matchResult = null;
  testDriveTankId = null;
  testDriveMoveTrailId = null;
  const ft = document.getElementById("taFoot");
  if (ft) ft.textContent = "";
  syncBattleTestLeaveUi();
  document.getElementById("taStage")!.hidden = true;
  document.getElementById("taBottom")!.hidden = true;
  const hub = document.getElementById("taHub");
  if (hub) hub.hidden = false;
  setHubTab("lobby");
  begin();
  skipBeginOnceOnEnterGame = true;
  refreshPurseDisplays();
  syncFortniteRail();
  const lead = document.getElementById("taLobbyLeadShort");
  if (lead) {
    lead.textContent = "Test beendet — wieder in der Lobby (ohne Aufgeben mit R).";
    window.clearTimeout(lobbyLeadResetTimer);
    lobbyLeadResetTimer = window.setTimeout(() => {
      lead.textContent = defaultLobbyLeadShort;
    }, 5500);
  }
  resumeLobbyTankIfNoOverlay();
  document.getElementById("taHubPlay")?.focus();
}

/** Spielfeld zu, Fortnite-Lobby zeigen — inkl. rotierende Panzer-Vorschau neu anwerfen */
function revealTankLobbyAfterEndingMatch(polishUi: () => void): void {
  const st = document.getElementById("taStage");
  const bt = document.getElementById("taBottom");
  const hb = document.getElementById("taHub");
  if (st) st.hidden = true;
  if (bt) bt.hidden = true;
  if (hb) hb.hidden = false;
  setHubTab("lobby");
  polishUi();
  resumeLobbyTankIfNoOverlay();
  document.getElementById("taHubPlay")?.focus();
}

const SURRENDER_TEXT_1 = "Willst du wirklich aufgeben?";
const SURRENDER_TEXT_2 = "Noch einmal sicher? Mit Ja gibst du diese Partie wirklich auf.";

function openSurrenderDialog(): void {
  surrenderStep = 1;
  const root = document.getElementById("taSurrender");
  const msg = document.getElementById("taSurrenderMsg");
  if (msg) msg.textContent = SURRENDER_TEXT_1;
  if (root) root.hidden = false;
  document.getElementById("taSurrenderJa")?.focus();
}

function closeSurrenderDialog(focusCanvas = true): void {
  surrenderStep = 0;
  const root = document.getElementById("taSurrender");
  if (root) root.hidden = true;
  if (focusCanvas) cv?.focus();
}

function confirmSurrender(): void {
  closeSurrenderDialog(false);
  abortActiveCombatFlightState();
  const ft = document.getElementById("taFoot");
  if (ft) ft.textContent = "";
  document.getElementById("taStage")!.hidden = true;
  document.getElementById("taBottom")!.hidden = true;
  const hub = document.getElementById("taHub");
  if (hub) hub.hidden = false;
  setHubTab("lobby");
  openGameOverOverlay("surrender");
}

function onSurrenderJa(): void {
  if (surrenderStep === 1) {
    surrenderStep = 2;
    const msg = document.getElementById("taSurrenderMsg");
    if (msg) msg.textContent = SURRENDER_TEXT_2;
    document.getElementById("taSurrenderJa")?.focus();
    return;
  }
  confirmSurrender();
}

function onSurrenderNein(): void {
  closeSurrenderDialog();
}

function openGameOverOverlay(kind: "win" | "lose" | "surrender", winGems?: number): void {
  matchResult = kind;
  const root = document.getElementById("taGameOver");
  const title = document.getElementById("taGameOverTitle");
  const sub = document.getElementById("taGameOverSub");
  const btn = document.getElementById("taGameOverBtn") as HTMLButtonElement | null;
  const lobbyBtn = document.getElementById("taGameOverLobbyBtn");
  const ft = document.getElementById("taFoot");
  const isTest = battleTestModeActive();
  if (title) {
    title.textContent =
      kind === "win"
        ? isTest
          ? "Testspiel gewonnen"
          : "Du hast gewonnen!"
        : kind === "surrender"
          ? "Du hast aufgegeben"
          : isTest
            ? "Testspiel verloren"
            : "Du hast verloren!";
  }
  if (sub) {
    const testLine = `Testmodus (${battleTestOverlaySuffix()}) · keine Belohnungen`;
    sub.textContent =
      kind === "win"
        ? isTest
          ? testLine
          : `Sieg · +${XP_WIN} XP · +${winGems ?? 0} 💎 · Level ${levelFromXp(readXp())}`
        : kind === "surrender"
          ? "Der Gegner gewinnt diese Runde. XP und 💎 bleiben unverändert. „Ins Spiel“ startet eine neue Runde."
          : isTest
            ? testLine
            : "Nochmal oder „Zurück zur Lobby“ — XP und 💎 bleiben gleich.";
  }
  if (kind === "win" || kind === "lose") {
    lobbyBtn?.removeAttribute("hidden");
    if (btn) btn.textContent = isTest ? "Nochmal testen" : kind === "win" ? "Nochmal spielen" : "Nochmal versuchen";
  } else {
    lobbyBtn?.setAttribute("hidden", "");
    if (btn) btn.textContent = "Weiter zur Lobby";
  }
  if (ft) ft.textContent = "";
  if (root) root.hidden = false;
  syncBattleTestLeaveUi();
  btn?.focus();
}

function closeGameOverOverlay(focusCanvas = true): void {
  const root = document.getElementById("taGameOver");
  if (root) root.hidden = true;
  matchResult = null;
  document.getElementById("taGameOverLobbyBtn")?.setAttribute("hidden", "");
  syncBattleTestLeaveUi();
  if (focusCanvas) cv?.focus();
}

function handleGameOverPlayAgain(): void {
  const kind = matchResult;
  const hub = document.getElementById("taHub");
  const surrenderFromLobby = !!(hub && !hub.hidden && kind === "surrender");
  closeGameOverOverlay(!surrenderFromLobby);
  if (surrenderFromLobby) {
    begin();
    skipBeginOnceOnEnterGame = true;
    polishReturnToLobbyAfterSurrender();
    resumeLobbyTankIfNoOverlay();
    document.getElementById("taHubPlay")?.focus();
    return;
  }
  begin();
  cv?.focus();
}

function handleGameOverReturnToLobbyFromUi(): void {
  const ending = matchResult;
  if (ending !== "win" && ending !== "lose") return;
  closeGameOverOverlay(false);
  if (testDriveActive()) testDriveTankId = null;
  if (testMoveTrailActive()) testDriveMoveTrailId = null;
  begin();
  skipBeginOnceOnEnterGame = true;
  revealTankLobbyAfterEndingMatch(ending === "win" ? polishReturnToLobbyAfterWin : polishReturnToLobbyAfterLoss);
}

function handleGameOverBackdropClick(): void {
  const k = matchResult;
  if (k === "win" || k === "lose") {
    handleGameOverReturnToLobbyFromUi();
    return;
  }
  handleGameOverPlayAgain();
}

function handleGameOverWinToLobby(): void {
  handleGameOverReturnToLobbyFromUi();
}

function refreshTankShopAndLocker(): void {
  refreshShopTankOffers();
  refreshShopGearOffers();
  refreshShopCosmeticOffers();
  refreshLockerTankOffers();
  refreshLockerUpgradeOffers();
  syncHubTankPreviewHints();
}

function rarityClassTank(id: PlayerTankId): string {
  if (id === "viper" || id === "bunker" || id === "desert") return "legendary";
  if (id === "crimson" || id === "navy") return "epic";
  return "rare";
}

function refreshShopTankOffers(): void {
  const ul = document.getElementById("taShopTankList");
  if (!ul) return;
  ul.replaceChildren();
  const gems = readGems();
  const owned = readOwnedTankIds();
  for (const def of PLAYER_TANKS) {
    const isOwned = owned.includes(def.id);
    const rarity = rarityClassTank(def.id);
    const li = document.createElement("li");
    li.className = `taShopCard taShopCard--fn taShopCard--${rarity} taShopTankCard${isOwned ? " taShopTankCard--owned" : ""}`;
    li.style.cursor = "pointer";
    li.addEventListener("click", (ev) => {
      if (ev.target instanceof HTMLElement && ev.target.closest("button")) return;
      hubShopLockerPreviewTankId = def.id;
      hubPreviewPaintUrgent = true;
      syncHubTankPreviewHints();
    });

    const title = document.createElement("span");
    title.className = "taShopCardTitle";
    title.textContent = def.nameDe;

    const meta = document.createElement("span");
    meta.className = "taShopCardMeta";
    meta.textContent = def.subtitleDe;

    const priceRow = document.createElement("span");
    priceRow.className = "taShopCardPrice";
    if (def.priceGems <= 0) priceRow.textContent = "Starter · gratis";
    else if (isOwned) priceRow.textContent = `Im Besitz · gekauft für ${def.priceGems} 💎`;
    else priceRow.textContent = `${def.priceGems} 💎`;

    const actions = document.createElement("div");
    actions.className = "taShopTankActions";

    const testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.className = "taLockerEquipBtn";
    testBtn.textContent = "Testspielen";
    testBtn.addEventListener("click", () => {
      testDriveMoveTrailId = null;
      testDriveTankId = def.id;
      closeShopOverlay();
      closeLockerOverlay();
      enterGameFromHub();
    });
    actions.appendChild(testBtn);

    if (def.priceGems <= 0) {
      const tag = document.createElement("span");
      tag.className = "taLockerSlotTag";
      tag.textContent = "Dabei";
      actions.appendChild(tag);
    } else if (isOwned) {
      const tag = document.createElement("span");
      tag.className = "taLockerSlotTag";
      tag.textContent = "Siehe Locker";
      actions.appendChild(tag);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "taShopTankBuyBtn";
      btn.textContent = `Kaufen (${def.priceGems} 💎)`;
      btn.dataset.tankPurchase = def.id;
      btn.disabled = gems < def.priceGems;
      btn.addEventListener("click", () => {
        const r = tryBuyTank(def.id);
        const msg = document.getElementById("taShopTankMsg");
        if (msg) {
          if (r === "ok") msg.textContent = `${def.nameDe} gekauft und ausgerüstet!`;
          else if (r === "expensive") msg.textContent = "Nicht genug 💎.";
          else if (r === "owned") msg.textContent = "Den Panzer hast du schon.";
          else msg.textContent = "";
        }
        refreshPurseDisplays();
      });
      actions.appendChild(btn);
    }

    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(priceRow);
    li.appendChild(actions);
    ul.appendChild(li);
  }
}

/** Spezial-Gegenstände für Panzer-Welle (Kristallschild Wüsten-Speer) */
function refreshShopGearOffers(): void {
  const ul = document.getElementById("taShopGearList");
  if (!ul) return;
  ul.replaceChildren();
  const gems = readGems();
  const ownsDesert = readOwnedTankIds().includes("desert");

  const li = document.createElement("li");
  li.className = `taShopCard taShopCard--fn taShopCard--legendary taShopTankCard`;

  const title = document.createElement("span");
  title.className = "taShopCardTitle";
  title.textContent = "Kristallschild";

  const meta = document.createElement("span");
  meta.className = "taShopCardMeta";
  const chGear = readDesertShieldCharges();
  meta.textContent = ownsDesert
    ? `Nur für Wüsten-Speer · Taste 5: +${DESERT_SHIELD_ABSORB} Sonnenkristall-Schutz, Treffer-Puls und Kuppel-Effekt · pro Shop-Kauf ${DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE} Aktivierungen.`
    : "Voraussetzung: Wüsten-Speer im Garage-Besitz — schütze ihn mit einer Sonnenkristall-Kuppel gegen Treffer.";

  const priceRow = document.createElement("span");
  priceRow.className = "taShopCardPrice";
  if (!ownsDesert) priceRow.textContent = "Nutze den Locker nach Kauf.";
  else if (chGear > 0) priceRow.textContent = `Noch ${chGear}× nutzbar`;
  else priceRow.textContent = `${DESERT_SHIELD_PRICE_GEMS} 💎 · neues Paket (${DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE}×)`;

  const actions = document.createElement("div");
  actions.className = "taShopTankActions";

  if (!ownsDesert) {
    const tag = document.createElement("span");
    tag.className = "taLockerSlotTag";
    tag.textContent = "Wüsten-Panzer kaufen";
    actions.appendChild(tag);
  } else if (chGear > 0) {
    const tag = document.createElement("span");
    tag.className = "taLockerSlotTag";
    tag.textContent = `${chGear} Aktivierungen · Shop bei 0`;
    actions.appendChild(tag);
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "taShopTankBuyBtn";
    btn.dataset.desertShieldBuy = "1";
    btn.textContent = `Nachkaufen (${DESERT_SHIELD_PRICE_GEMS} 💎)`;
    btn.disabled = gems < DESERT_SHIELD_PRICE_GEMS;
    btn.addEventListener("click", () => {
      const r = tryBuyDesertShield();
      const msg = document.getElementById("taShopGearMsg");
      if (msg) {
        if (r === "ok") {
          msg.textContent = `Sonnenkristall-Schild — ${DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE} Aktivierungen. Taste 5 (fahren oder zielen).`;
        } else if (r === "expensive") msg.textContent = "Nicht genug 💎.";
        else if (r === "owned") msg.textContent = "Hast du schon.";
        else if (r === "missing_tank") msg.textContent = "Brauchst erst den Wüsten-Panzer.";
        else msg.textContent = "";
      }
      refreshPurseDisplays();
    });
    actions.appendChild(btn);
  }

  li.appendChild(title);
  li.appendChild(meta);
  li.appendChild(priceRow);
  li.appendChild(actions);
  ul.appendChild(li);
}

const MOVE_TRAIL_SHOP_ROWS: readonly {
  id: PurchasableMoveTrailId;
  title: string;
  meta: string;
  price: number;
}[] = [
  {
    id: "fire",
    title: "Feuerspur",
    meta: "Glut und Funken hinter den Ketten (← → Fahren). Kaufen, ausrüsten oder mit „Testen“ ansehen — kein Gameplay-Bonus.",
    price: MOVE_TRAIL_FIRE_PRICE_GEMS,
  },
  {
    id: "lightning",
    title: "Blitzspur",
    meta: "Kleine Funken und Lichtbögen beim Rangieren. Kaufen, ausrüsten oder „Testen“ — nur Optik.",
    price: MOVE_TRAIL_LIGHTNING_PRICE_GEMS,
  },
];

function refreshShopCosmeticOffers(): void {
  const ul = document.getElementById("taShopCosmeticList");
  if (!ul) return;
  ul.replaceChildren();
  const gems = readGems();
  const owned = new Set(readOwnedMoveTrailIds());
  const equipped = readEquippedMoveTrail();

  const noneLi = document.createElement("li");
  noneLi.className = "taShopCard taShopCard--fn taShopCard--rare taShopTankCard";
  const noneTitle = document.createElement("span");
  noneTitle.className = "taShopCardTitle";
  noneTitle.textContent = "Standard — keine Spur";
  const noneMeta = document.createElement("span");
  noneMeta.className = "taShopCardMeta";
  noneMeta.textContent = "Immer verfügbar. Keine Partikel — nur hier im Shop umschalten.";
  const nonePrice = document.createElement("span");
  nonePrice.className = "taShopCardPrice";
  nonePrice.textContent = "0 💎";
  const noneAct = document.createElement("div");
  noneAct.className = "taShopTankActions";
  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.className = "taShopTankBuyBtn";
  noneBtn.textContent = equipped === "none" ? "Aktiv" : "Ausrüsten";
  noneBtn.disabled = equipped === "none";
  noneBtn.addEventListener("click", () => {
    void setEquippedMoveTrail("none");
    refreshTankShopAndLocker();
    const msg = document.getElementById("taShopCosmeticMsg");
    if (msg) msg.textContent = "Keine Fahr-Spur aktiv.";
  });
  noneAct.appendChild(noneBtn);
  noneLi.append(noneTitle, noneMeta, nonePrice, noneAct);
  ul.appendChild(noneLi);

  for (const row of MOVE_TRAIL_SHOP_ROWS) {
    const isOwned = owned.has(row.id);
    const li = document.createElement("li");
    li.className = `taShopCard taShopCard--fn taShopCard--epic taShopTankCard${isOwned ? " taShopTankCard--owned" : ""}`;
    const title = document.createElement("span");
    title.className = "taShopCardTitle";
    title.textContent = row.title;
    const meta = document.createElement("span");
    meta.className = "taShopCardMeta";
    meta.textContent = row.meta;
    const priceRow = document.createElement("span");
    priceRow.className = "taShopCardPrice";
    if (isOwned) priceRow.textContent = `Im Besitz · gekauft für ${row.price} 💎`;
    else priceRow.textContent = `${row.price} 💎`;
    const actions = document.createElement("div");
    actions.className = "taShopTankActions";
    const testTr = document.createElement("button");
    testTr.type = "button";
    testTr.className = "taLockerEquipBtn";
    testTr.textContent = "Testen";
    testTr.dataset.moveTrailTest = row.id;
    testTr.addEventListener("click", () => {
      testDriveMoveTrailId = row.id;
      closeShopOverlay();
      closeLockerOverlay();
      enterGameFromHub();
    });
    actions.appendChild(testTr);
    if (isOwned) {
      const eq = document.createElement("button");
      eq.type = "button";
      eq.className = "taShopTankBuyBtn";
      eq.textContent = equipped === row.id ? "Aktiv" : "Ausrüsten";
      eq.disabled = equipped === row.id;
      eq.dataset.moveTrailEquip = row.id;
      eq.addEventListener("click", () => {
        void setEquippedMoveTrail(row.id);
        refreshTankShopAndLocker();
        const msg = document.getElementById("taShopCosmeticMsg");
        if (msg) msg.textContent = `${row.title} ist jetzt deine Fahr-Spur.`;
      });
      actions.appendChild(eq);
    } else {
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "taShopTankBuyBtn";
      buy.dataset.moveTrailPurchase = row.id;
      buy.textContent = `Kaufen (${row.price} 💎)`;
      buy.disabled = gems < row.price;
      buy.addEventListener("click", () => {
        const r = tryBuyMoveTrailCosmetic(row.id);
        const msg = document.getElementById("taShopCosmeticMsg");
        if (msg) {
          if (r === "ok") msg.textContent = `${row.title} gekauft und ausgerüstet!`;
          else if (r === "expensive") msg.textContent = "Nicht genug 💎.";
          else if (r === "owned") msg.textContent = "Hast du schon.";
          else msg.textContent = "";
        }
        refreshPurseDisplays();
      });
      actions.appendChild(buy);
    }
    li.append(title, meta, priceRow, actions);
    ul.appendChild(li);
  }
}

const LOCKER_UPGRADE_UI_ORDER: readonly LockerUpgradeBranchId[] = ["fuel", "damage", "power"];

function refreshLockerUpgradeOffers(): void {
  const ul = document.getElementById("taLockerUpgradeList");
  if (!ul) return;
  ul.replaceChildren();
  const gems = readGems();
  const levels = readLockerUpgradeLevels();

  for (const branch of LOCKER_UPGRADE_UI_ORDER) {
    const meta = LOCKER_UPGRADE_META[branch];
    const L = levels[branch];
    const li = document.createElement("li");
    li.className = "taLockerUpgradeRow taShopCard taShopCard--fn taShopCard--epic taShopTankCard";

    const title = document.createElement("span");
    title.className = "taShopCardTitle";
    title.textContent = meta.titleDe;

    const val = document.createElement("span");
    val.className = "taShopCardMeta";
    if (branch === "fuel") {
      val.textContent = `${meta.subtitleDe} Stufe ${L}/${LOCKER_UPGRADE_MAX_LEVEL} · +${lockerUpgradeFuelBonus(L)} Treibstoff zur Basis ${FUEL_MOVE}.`;
    } else if (branch === "damage") {
      val.textContent = `${meta.subtitleDe} Stufe ${L}/${LOCKER_UPGRADE_MAX_LEVEL} · Schaden ×${lockerUpgradeDamageMul(L).toFixed(2)}.`;
    } else {
      val.textContent = `${meta.subtitleDe} Stufe ${L}/${LOCKER_UPGRADE_MAX_LEVEL} · Kraft-Maximum ${PLAYER_POW_MAX_BASE + lockerUpgradePowMaxDelta(L)}.`;
    }

    const price = document.createElement("span");
    price.className = "taShopCardPrice";

    const actions = document.createElement("div");
    actions.className = "taShopTankActions";

    if (L >= LOCKER_UPGRADE_MAX_LEVEL) {
      price.textContent = "Stufe 10 — Maximum";
      const tag = document.createElement("span");
      tag.className = "taLockerSlotTag";
      tag.textContent = "Komplett";
      actions.appendChild(tag);
    } else {
      const nextCost = lockerUpgradeStepCostGems(branch, L);
      price.textContent = `Nächste Stufe: ${nextCost} 💎`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "taShopTankBuyBtn";
      btn.textContent = `Stufe ${L + 1} kaufen`;
      btn.dataset.lockerUpgrade = branch;
      btn.disabled = gems < nextCost;
      btn.addEventListener("click", () => {
        const r = tryBuyLockerUpgrade(branch);
        const msg = document.getElementById("taLockerUpgradeMsg");
        if (msg) {
          if (r === "ok") msg.textContent = `${meta.titleDe} ist jetzt Stufe ${L + 1}.`;
          else if (r === "expensive") msg.textContent = "Nicht genug 💎.";
          else msg.textContent = "";
        }
        refreshPurseDisplays();
      });
      actions.appendChild(btn);
    }

    li.append(title, val, price, actions);
    ul.appendChild(li);
  }
}

function refreshLockerTankOffers(): void {
  const ul = document.getElementById("taLockerTankList");
  if (!ul) return;
  ul.replaceChildren();
  const equipped = readEquippedTankId();
  const ownedSet = new Set(readOwnedTankIds());

  for (const def of PLAYER_TANKS) {
    const isOwned = ownedSet.has(def.id);
    const active = equipped === def.id;
    const li = document.createElement("li");
    li.className = `taLockerSlot taLockerTankRow${active ? " taLockerTankRow--active" : ""}${!isOwned ? " taLockerSlot--soon" : ""}`;
    li.style.cursor = "pointer";
    li.addEventListener("click", (ev) => {
      if (ev.target instanceof HTMLElement && ev.target.closest("button")) return;
      hubShopLockerPreviewTankId = def.id;
      hubPreviewPaintUrgent = true;
      syncHubTankPreviewHints();
    });

    const lbl = document.createElement("span");
    lbl.className = "taLockerSlotLabel";
    lbl.textContent = def.nameDe;

    const val = document.createElement("span");
    val.className = "taLockerSlotValue";
    val.textContent = isOwned ? def.weapons.map((w) => w.nameDe).join(" · ") : `Shop · ${def.priceGems} 💎`;

    const right = document.createElement("span");
    right.className = "taLockerSlotTag";

    if (!isOwned) {
      right.textContent = `🔒 ${def.priceGems} 💎`;
      li.appendChild(lbl);
      li.appendChild(val);
      li.appendChild(right);
    } else if (active) {
      right.textContent = "Ausgerüstet";
      li.appendChild(lbl);
      li.appendChild(val);
      li.appendChild(right);
    } else {
      const wrap = document.createElement("span");
      wrap.className = "taShopTankActions";

      const testBtn = document.createElement("button");
      testBtn.type = "button";
      testBtn.className = "taLockerEquipBtn";
      testBtn.textContent = "Testspielen";
      testBtn.addEventListener("click", () => {
        testDriveMoveTrailId = null;
        testDriveTankId = def.id;
        closeLockerOverlay();
        closeShopOverlay();
        enterGameFromHub();
      });

      const b = document.createElement("button");
      b.type = "button";
      b.className = "taLockerEquipBtn";
      b.textContent = "Ausrüsten";
      b.addEventListener("click", () => {
        if (setEquippedTankId(def.id)) refreshTankShopAndLocker();
      });

      wrap.appendChild(testBtn);
      wrap.appendChild(b);
      li.appendChild(lbl);
      li.appendChild(val);
      li.appendChild(wrap);
    }
    ul.appendChild(li);
  }
}

function refreshPurseDisplays(): void {
  const xe = document.getElementById("taXp");
  const le = document.getElementById("taLvl");
  if (xe) xe.textContent = String(readXp());
  if (le) le.textContent = String(levelFromXp(readXp()));
  const gems = adminGemsUnlocked() ? "∞" : String(readGems());
  const xStr = String(readXp());
  const lvl = String(levelFromXp(readXp()));
  const pairs: [string, string][] = [
    ["taHubGems", gems],
    ["taHubXpHud", xStr],
    ["taHubLvlHud", lvl],
    ["taShopGems", gems],
    ["taShopXpHud", xStr],
    ["taShopLvlHud", lvl],
    ["taLockerGems", gems],
    ["taLockerXpHud", xStr],
    ["taLockerLvlHud", lvl],
  ];
  for (const [id, v] of pairs) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }
  refreshTankShopAndLocker();
  /** Insane freischalten sobald XP >= 3000 erreicht (ohne Reload). */
  syncMapPrefsUi();
}

function blitzLoadoutHudLine(): string {
  if (!blitzWaveUnlockedForCurrentMatch()) {
    const n = rundenBisBlitzAnzeige();
    return `4. ${BLITZ_DISPLAY_NAME_DE} · in ${n} Runde${n === 1 ? "" : "n"}`;
  }
  if (blitzConsumedThisMatch) return `4. ${BLITZ_DISPLAY_NAME_DE} · verbraucht`;
  const name = blitzBuddyDe ? ` · ${blitzBuddyDe}` : "";
  return `4. ${BLITZ_DISPLAY_NAME_DE}${name} · bereit`;
}

function shieldLoadoutHudLine(): string | null {
  if (readEquippedTankId() !== "desert" || !readDesertShieldOwned()) return null;
  const ch = readDesertShieldCharges();
  const chLabel = `${ch}/${DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE}`;
  if (playerShieldAbsorb > 0) {
    return `5. Sonnenkristall · aktiv (${playerShieldAbsorb}/${DESERT_SHIELD_ABSORB}) · ${chLabel} Akt.`;
  }
  return `5. Sonnenkristall · Taste 5 · +${DESERT_SHIELD_ABSORB} · ${chLabel} Akt.`;
}

function hudTxt(): void {
  const hWind = document.getElementById("taWind")!;
  const hPh = document.getElementById("taPhase")!;
  const hWp = document.getElementById("taWeapon")!;
  const hHp = document.getElementById("taHp");
  const wStr = wa >= 0 ? "+" + wa.toFixed(1) : wa.toFixed(1);
  hWind.textContent = wStr + " px/s²";
  if (isBlitzSlot(selectedSlot)) {
    if (canUseBlitzNow()) {
      hWp.textContent = blitzBuddyDe
        ? `${BLITZ_DISPLAY_NAME_DE} (${blitzBuddyDe}) · 1×`
        : `${BLITZ_DISPLAY_NAME_DE} · 1× diese Welle`;
    } else if (blitzWaveUnlockedForCurrentMatch() && blitzConsumedThisMatch) {
      hWp.textContent = `${BLITZ_DISPLAY_NAME_DE} · verbraucht`;
    } else {
      const n = rundenBisBlitzAnzeige();
      hWp.textContent = `${BLITZ_DISPLAY_NAME_DE} · in ${n} Runde${n === 1 ? "" : "n"}`;
    }
  } else {
    hWp.textContent = pw()[selectedSlot]!.nameDe;
  }
  if (hHp) {
    const sh =
      playerShieldAbsorb > 0 ? ` · Schild ${playerShieldAbsorb}` : "";
    hHp.textContent = "Du " + hpP + sh + " · Gegner " + hpB;
  }
  const testPrefix = hudBattleTestPrefix();
  if (ph === "m") hPh.textContent = testPrefix + "Fahren · Treibstoff " + fuelP;
  else if (ph === "aim") {
    const now = performance.now();
    const wall =
      !isBlitzSlot(selectedSlot) && playerBarrelLosBlocked()
        ? " · Rohr blockiert (Gelände) — Winkel/Power ändern"
        : "";
    const bump = now < barrelBlockedHintUntil ? " · Schuss geblockt" : "";
    const blitzAlt = lockerMaxSpecialUnlocked() ? "1–3 oder 6" : "1–3";
    hPh.textContent =
      isBlitzSlot(selectedSlot)
        ? canUseBlitzNow()
          ? testPrefix + `Blitz · ${blitzBuddyDe ? blitzBuddyDe + " · " : ""}A/D Platz · Klick · Leertaste`
          : testPrefix + `Blitz nicht verfügbar — andere Wahl mit ${blitzAlt}`
        : testPrefix +
            "Zielen · A/D Winkel · W/S Kraft · " +
            ang.toFixed(1) +
            "° · " +
            Math.round(pow) +
            " · Shift fein" +
            wall +
            bump;
  }
  else if (ph === "pf" || ph === "bf") hPh.textContent = "Flug…";
  else hPh.textContent = "Bot zielt …";
}

function hash01(n: number): number {
  const x = Math.sin(n) * 10_000;
  return x - Math.floor(x);
}

function drawInsaneFireAndSmoke(now: number): void {
  // Feuerpunkte entlang des Bodens – deterministisch nach x, flackert über Zeit.
  const t = now * 0.001;
  const nFires = 18;
  for (let i = 0; i < nFires; i++) {
    const u = (i + 1) / (nFires + 1);
    const x = Math.floor(camX + u * (VIEW_W - 1));
    const y = gy(x);
    const h = 18 + hash01(i * 91.7) * 22;
    const flick = 0.65 + 0.35 * Math.sin(t * (2.6 + i * 0.2) + i * 1.9);
    const w = 10 + hash01(i * 17.3) * 18;

    // Rauch
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.18 * flick;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    for (let k = 0; k < 4; k++) {
      const ry = (h * 0.8 + k * 10) * (0.7 + hash01(i * 33.1 + k * 7.2) * 0.55);
      const rx = (w * 0.6 + k * 5) * (0.7 + hash01(i * 77.2 + k * 3.1) * 0.6);
      ctx.beginPath();
      ctx.ellipse(
        x + Math.sin(t * 0.7 + i) * (4 + k * 1.5),
        y - (22 + k * 18) - Math.sin(t * 0.9 + k) * 2,
        rx,
        ry,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();

    // Flamme
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.globalAlpha = 0.9;
    const g = ctx.createRadialGradient(0, -h * 0.35, 2, 0, -h * 0.25, Math.max(18, h * 1.2));
    g.addColorStop(0, "rgba(255,251,235,0.98)");
    g.addColorStop(0.35, "rgba(251,191,36,0.92)");
    g.addColorStop(0.62, "rgba(249,115,22,0.75)");
    g.addColorStop(0.82, "rgba(239,68,68,0.35)");
    g.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.35, w * 0.55, h * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawInsaneEndOverlay(): void {
  // "Background am Ende": dunkle Vignette + leichter Staubschleier oben.
  ctx.save();
  const vg = ctx.createRadialGradient(WORLD.W * 0.52, WORLD.H * 0.42, WORLD.H * 0.25, WORLD.W * 0.5, WORLD.H * 0.5, WORLD.H * 0.92);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  const haze = ctx.createLinearGradient(0, 0, 0, WORLD.H * 0.42);
  haze.addColorStop(0, "rgba(253,230,138,0.16)");
  haze.addColorStop(0.55, "rgba(148,163,184,0.04)");
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, WORLD.W, WORLD.H * 0.5);
  ctx.restore();
}

function drawSkyAndClouds(now: number): void {
  if (mapDifficulty === "insane") {
    // Apokalyptischer Himmel für Insane (egal ob Erde/Mond gewählt).
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.H * 0.62);
    sky.addColorStop(0, "#1b0b12");
    sky.addColorStop(0.3, "#3b0f12");
    sky.addColorStop(0.62, "#5b1b14");
    sky.addColorStop(1, "#0b1020");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.W, WORLD.H);
    ctx.fillStyle = "rgba(234,88,12,0.12)";
    ctx.fillRect(0, WORLD.H * 0.22, WORLD.W, WORLD.H * 0.26);
    drawAirplanes(now);
    return;
  }
  if (mapBattleTheme === "moon") {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.H * 0.52);
    sky.addColorStop(0, "#070a12");
    sky.addColorStop(0.35, "#12182a");
    sky.addColorStop(0.72, "#1c2436");
    sky.addColorStop(1, "#252e42");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.W, WORLD.H);

    for (let i = 0; i < 96; i++) {
      const sx = ((i * 1409) % (WORLD.W - 14)) + 7;
      const sy = ((i * 877) % Math.max(1, Math.floor(WORLD.H * 0.4))) + 6;
      const br = i % 11 === 0 ? 2.2 : i % 4 === 0 ? 1.6 : 1.05;
      ctx.fillStyle = i % 9 === 0 ? "rgba(254, 243, 199, 0.92)" : "rgba(226, 232, 240, 0.72)";
      ctx.beginPath();
      ctx.arc(sx, sy, br, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Ferne Erde am Himmel */
    ctx.save();
    const ex = 86;
    const ey = 72;
    ctx.beginPath();
    ctx.arc(ex, ey, 28, 0, Math.PI * 2);
    const eg = ctx.createRadialGradient(ex - 9, ey - 9, 4, ex, ey, 30);
    eg.addColorStop(0, "#5b8fd4");
    eg.addColorStop(0.45, "#2d6a9f");
    eg.addColorStop(0.72, "#1e3d5c");
    eg.addColorStop(1, "#0f172a");
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
    ctx.fillRect(0, WORLD.H * 0.34, WORLD.W, WORLD.H * 0.22);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.H * 0.5);
  sky.addColorStop(0, "#38bdf8");
  sky.addColorStop(0.35, "#7dd3fc");
  sky.addColorStop(0.72, "#bae6fd");
  sky.addColorStop(1, "#fdf4ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  /* Bonbon-Sonne oben rechts */
  ctx.save();
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(WORLD.W - 56, 48, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const drawPuff = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawPuff(WORLD.W * 0.42, 92, WORLD.W * 0.068, 40);
  drawPuff(WORLD.W * 0.39, 104, WORLD.W * 0.054, 32);
  drawPuff(WORLD.W * 0.07, 68, WORLD.W * 0.058, 36);
  drawPuff(WORLD.W * 0.22, 116, WORLD.W * 0.046, 28);

  ctx.fillStyle = "rgba(125, 211, 252, 0.32)";
  ctx.fillRect(0, WORLD.H * 0.36, WORLD.W, WORLD.H * 0.2);
}

/** Bei Blitz: eine senkrechte Ziel-Linie von oben zur Bodenlage am Einschlags-X. */
function drawSkyBlitzAimPreview(): void {
  clampBlitzAim();
  const xx = Math.round(blitzStrikeX);
  const gy0 = gy(xx);
  const topY = -36;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([7, 12]);
  ctx.shadowColor = mapBattleTheme === "moon" ? "rgba(56, 189, 248, 0.35)" : "rgba(15, 23, 42, 0.36)";
  ctx.shadowBlur = mapBattleTheme === "moon" ? 8 : 5;
  ctx.beginPath();
  ctx.moveTo(xx, topY);
  ctx.lineTo(xx, gy0 + 4);
  ctx.strokeStyle = mapBattleTheme === "moon" ? "rgba(186, 230, 253, 0.98)" : "rgba(125, 211, 252, 0.98)";
  ctx.lineWidth = mapBattleTheme === "moon" ? 4.5 : 4;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2.25;
  ctx.strokeStyle =
    mapBattleTheme === "moon" ? "rgba(224, 242, 254, 0.82)" : "rgba(14, 165, 233, 0.65)";
  ctx.beginPath();
  ctx.moveTo(xx - 11, gy0 + 3);
  ctx.lineTo(xx + 11, gy0 + 3);
  ctx.moveTo(xx, gy0 - 5);
  ctx.lineTo(xx, gy0 + 11);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Gestrichelte Flugbahn-Vorschau — geschossene Slots 0–2 */
function drawAimTrajectoryPreview(): void {
  if (ph !== "aim") return;
  if (isBlitzSlot(selectedSlot)) {
    drawSkyBlitzAimPreview();
    return;
  }
  const Wp = pw()[selectedSlot]!;
  if (playerBarrelLosBlocked()) return;
  const mu = mP(px, true);
  const pb = Wp.pelletBurst;

  if (pb && pb.count >= 2) {
    const dustFan = pb.spreadHalfDeg >= 11;
    const nFan = Math.min(11, Math.max(5, Math.floor(pb.count / 2)));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([5, 9]);
    ctx.shadowColor = dustFan ? "rgba(180, 83, 9, 0.22)" : "rgba(15, 23, 42, 0.25)";
    ctx.shadowBlur = dustFan ? 6 : 4;
    ctx.lineWidth = dustFan ? 2.6 : 2;

    for (let q = 0; q < nFan; q++) {
      const k = nFan <= 1 ? 0 : (q / (nFan - 1)) * 2 - 1;
      const v = velocityFromElevDeg(true, ang + k * pb.spreadHalfDeg, pow, Wp.velMul);
      const pts = sampleTrajectory(T, mu.x, mu.y, v.x, v.y, wa, 1000, FLIGHT_DT, weaponDragMul(Wp));
      if (pts.length < 2) continue;
      const center = q === ((nFan - 1) >> 1);
      ctx.globalAlpha = (dustFan ? 0.34 : 0.24) + (center ? (dustFan ? 0.34 : 0.38) : 0);
      ctx.strokeStyle = dustFan ? "rgba(253, 230, 138, 0.95)" : "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.moveTo(mu.x, mu.y);
      for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();
    return;
  }

  const v = velocityFromElevDeg(true, ang, pow, Wp.velMul);
  const pts = sampleTrajectory(T, mu.x, mu.y, v.x, v.y, wa, 1200, FLIGHT_DT, weaponDragMul(Wp));
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([7, 11]);
  ctx.shadowColor = "rgba(15, 23, 42, 0.38)";
  ctx.shadowBlur = 5;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(mu.x, mu.y);
  for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawTerrainMass(): void {
  const x0 = Math.max(0, Math.floor(camX) - 2);
  const x1 = Math.min(worldW - 1, x0 + VIEW_W + 4);
  ctx.beginPath();
  ctx.moveTo(x0, WORLD.H);
  for (let x = x0; x <= x1; x++) ctx.lineTo(x, heightAt(T, x));
  ctx.lineTo(x1, WORLD.H);
  ctx.closePath();

  if (mapDifficulty === "insane") {
    // Nur Erde: verbrannte, braune Schichten – kein Grün/Gras.
    const reg = ctx.createLinearGradient(0, 80, 0, WORLD.H);
    reg.addColorStop(0, "#b45309");
    reg.addColorStop(0.14, "#92400e");
    reg.addColorStop(0.42, "#78350f");
    reg.addColorStop(0.74, "#451a03");
    reg.addColorStop(1, "#1f1307");
    ctx.fillStyle = reg;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.7)";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(249,115,22,0.18)";
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(x0, heightAt(T, x0));
    for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(253,224,71,0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, heightAt(T, x0) + 9);
    for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x) + 9);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (mapBattleTheme === "moon") {
    const reg = ctx.createLinearGradient(0, 70, 0, WORLD.H);
    reg.addColorStop(0, "#b8bcc4");
    reg.addColorStop(0.14, "#9599a3");
    reg.addColorStop(0.42, "#6f737c");
    reg.addColorStop(0.74, "#52555c");
    reg.addColorStop(1, "#3a3d44");
    ctx.fillStyle = reg;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(226,232,240,0.12)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(x0, heightAt(T, x0));
    for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(203,213,225,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, heightAt(T, x0) + 9);
    for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x) + 9);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const earth = ctx.createLinearGradient(0, 80, 0, WORLD.H);
  earth.addColorStop(0, "#bef264");
  earth.addColorStop(0.12, "#84cc16");
  earth.addColorStop(0.4, "#65a30d");
  earth.addColorStop(0.75, "#4d7c0f");
  earth.addColorStop(1, "#365314");
  ctx.fillStyle = earth;
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(234,179,8,0.25)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x0, heightAt(T, x0));
  for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(212,231,146,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, heightAt(T, x0) + 8);
  for (let x = x0 + 1; x <= x1; x++) ctx.lineTo(x, heightAt(T, x) + 8);
  ctx.stroke();
  ctx.restore();
}

function drawTankSprite(
  cx: number,
  groundY: number,
  slope: number,
  facingRight: boolean,
  rect: { x: number; y: number; w: number; h: number },
  img: HTMLImageElement,
  tankFxId?: PlayerTankId,
  timeMs = performance.now(),
): void {
  const targetW = 88;
  const sc = targetW / rect.w;
  const dw = rect.w * sc;
  const dh = rect.h * sc;
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.rotate(slope);
  if (!facingRight) ctx.scale(-1, 1);
  if (tankFxId) drawTankVisualFxLocal(ctx, tankFxId, dw, dh, timeMs);
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

function atlasRectForEnemySkin(theme: EnemyTankSkin): { x: number; y: number; w: number; h: number } {
  switch (theme) {
    case "green":
      return ATLAS.tankGreenEnemy;
    case "navy":
      return ATLAS.tankNavy;
    case "white":
      return ATLAS.tankDesert;
    case "silver":
      return ATLAS.tankGrey;
  }
}

function drawTankPlaced(
  cx: number,
  rect: { x: number; y: number; w: number; h: number },
  facingRight: boolean,
  tankFxId?: PlayerTankId,
  timeMs = performance.now(),
): void {
  const img = spriteSheet;
  if (!img?.complete || img.naturalWidth < 16) return;
  const groundY = hullGroundY(cx);
  const slope = hullSlope(cx);
  drawTankSprite(cx, groundY, slope, facingRight, rect, img, tankFxId, timeMs);
}

function drawPlayerTankPlaced(nowMs: number): void {
  const def = activeTankDef();
  const key = customSpriteKeyForTank(def);
  if (key != null) {
    const groundY = hullGroundY(px);
    const slope = hullSlope(px);
    ctx.save();
    ctx.translate(px, groundY);
    ctx.rotate(slope);
    const drawn = drawGeneratedTankSpriteLocal(
      ctx,
      key,
      def.id,
      0,
      true,
      nowMs,
      1,
      1,
    );
    ctx.restore();
    if (drawn) return;
  }
  drawTankPlaced(px, atlasRectPlayer(), true, def.id, nowMs);
}

/** Halbtransparente Kristallkuppel um den Wüsten-Speer bei aktivem Schild. */
function drawPlayerDesertShieldBubble(): void {
  if (playerShieldAbsorb <= 0) return;
  const now = performance.now();
  const gy = hullGroundY(px);
  const cx = px;
  const charge = Math.max(0, Math.min(1, playerShieldAbsorb / DESERT_SHIELD_ABSORB));
  const hitT = now < shieldImpactUntil ? Math.max(0, 1 - (shieldImpactUntil - now) / 520) : 1;
  const hitFlash = now < shieldImpactUntil ? 1 - hitT : 0;
  const rx = TANK_HALF_W * (2.55 + hitFlash * 0.3);
  const ry = TANK_HALF_H * (2.82 + hitFlash * 0.24);
  ctx.save();
  ctx.translate(cx, gy - TANK_HALF_H * 0.42);

  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.34 + pulse * 0.08 + hitFlash * 0.22;
  const g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.45, 2, 0, 0, Math.max(rx, ry) * 1.08);
  g.addColorStop(0, "rgba(254,249,195,0.62)");
  g.addColorStop(0.42, "rgba(56,189,248,0.36)");
  g.addColorStop(0.72, "rgba(59,130,246,0.22)");
  g.addColorStop(1, "rgba(37,99,235,0.04)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.74 + hitFlash * 0.22;
  ctx.strokeStyle = hitFlash > 0 ? "rgba(254,240,138,0.9)" : "rgba(125,211,252,0.68)";
  ctx.lineWidth = 3.4 + hitFlash * 2;
  ctx.stroke();

  ctx.globalAlpha = 0.42 + pulse * 0.2;
  ctx.strokeStyle = "rgba(254,240,138,0.58)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 3) + now * 0.0007;
    const x = Math.cos(a) * rx * 0.74;
    const y = Math.sin(a) * ry * 0.72;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.globalAlpha = 0.22 + charge * 0.28;
  ctx.strokeStyle = "rgba(224,242,254,0.66)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const y = -ry * 0.48 + i * (ry * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, y, rx * (0.36 + i * 0.07), ry * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (hitFlash > 0) {
    ctx.globalAlpha = hitFlash * 0.78;
    ctx.strokeStyle = "rgba(254,249,195,0.9)";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (1.05 + hitT * 0.22), ry * (1.05 + hitT * 0.22), 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = `900 13px ${HUD_FF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(254,249,195,0.96)";
    ctx.strokeStyle = "rgba(15,23,42,0.7)";
    ctx.lineWidth = 4;
    const label = `-${shieldImpactAbsorbed}`;
    ctx.strokeText(label, 0, -ry - 14 - hitT * 10);
    ctx.fillText(label, 0, -ry - 14 - hitT * 10);
  }

  ctx.restore();
}

function drawSmokeTrailAhead(j: number): void {
  if (tr.length >= 4) drawSmokeTrailOnPath(tr, j, 26);
}

/** Rauch-/Staubspur hinter Streukügeln oder Direktgeschoss (Farbe abhängig von Waffe). */
function drawSmokeTrailOnPath(
  path: Array<{ x: number; y: number }>,
  j: number,
  spanMax = 18,
  tone: "warm" | "dust" | "pellet" = "warm",
): void {
  if (j < 3 || path.length < 4) return;
  const span = Math.min(spanMax, j);
  const lo = Math.max(0, j - span);
  ctx.save();
  for (let i = lo; i < j; i++) {
    const p = path[i]!;
    const t = (i - lo) / Math.max(1, j - lo);
    const baseA = tone === "dust" ? 0.16 : tone === "pellet" ? 0.14 : 0.1;
    const topA = tone === "dust" ? 0.48 : tone === "pellet" ? 0.44 : 0.32;
    ctx.globalAlpha = baseA + t * topA;
    if (tone === "dust") {
      ctx.fillStyle = i % 3 === 0 ? "#fef9c3" : i % 3 === 1 ? "#fde68a" : "#d4a574";
    } else if (tone === "pellet") {
      ctx.fillStyle = i % 3 === 0 ? "#fffef0" : i % 3 === 1 ? "#fef08a" : "#fed7aa";
    } else {
      ctx.fillStyle = i % 3 === 0 ? "#fffde4" : "#fde68a";
    }
    ctx.strokeStyle = tone === "dust" ? "rgba(120,53,15,0.22)" : "rgba(15,23,42,0.2)";
    ctx.lineWidth = tone === "dust" || tone === "pellet" ? 2 : 1.5;
    const r = (tone === "dust" ? 2.2 : tone === "pellet" ? 2 : 1.8) + t * (tone === "dust" ? 3.4 : tone === "pellet" ? 3.2 : 2.6);
    ctx.beginPath();
    ctx.arc(p.x, p.y + 1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawProjectile(pos: { x: number; y: number }, prev: { x: number; y: number } | null): void {
  drawProjectileSized(pos, prev, projectileInFlightStyle ?? DEFAULT_PROJECTILE_GLOW, 1);
}

/** Kleine Streukügelchen — gleiches Sprite, ca. halbe Größe */
function drawProjectileSized(
  pos: { x: number; y: number },
  prev: { x: number; y: number } | null,
  g: ProjectileGlow,
  sizeMul: number,
): void {
  const img = spriteSheet;
  const r = ATLAS.bulletFly3;
  const flyRot = prev ? Math.atan2(pos.y - prev.y, pos.x - prev.x) : 0;
  if (img?.complete && img.naturalWidth > 2) {
    const bw = 56 * sizeMul;
    const bh = bw * (r.h / r.w);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(flyRot);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, bw * 0.55);
    glow.addColorStop(0, g.core);
    glow.addColorStop(0.5, g.mid);
    glow.addColorStop(1, g.rim);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.45, bh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = g.shadow;
    ctx.shadowBlur = 14;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  } else {
    const pr = 9 * sizeMul;
    ctx.save();
    ctx.fillStyle = g.core;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2, 4 * sizeMul);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(pos.x - pr * 0.22, pos.y - pr * 0.22, Math.max(1.8, pr * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Rohroverlay Spieler — Turm‑Pivot → Mündung (`barrelVisAng` + Recoil + leichtes Wind-Wackeln). */
function drawPlayerBarrelAim(): void {
  if ((ph !== "aim" && ph !== "m") || (ph === "aim" && isBlitzSlot(selectedSlot))) return;
  const pivot = hullPivot(px);
  const tNow = performance.now();
  const windWobble =
    ph === "aim" && !isBlitzSlot(selectedSlot)
      ? Math.sin(tNow * 0.0029 + px * 0.017) * (0.75 + Math.min(2.2, Math.abs(wa)) * 0.04)
      : ph === "m"
        ? Math.sin(tNow * 0.0019) * 0.35
        : 0;
  const visDeg = barrelVisAng + barrelRecoilDeg + windWobble;
  const tip = muzzleAt(px, true, visDeg);
  const faded = ph === "m";
  const blocked = ph === "aim" && !isBlitzSlot(selectedSlot) && playerBarrelLosBlocked();
  const lwOuter = faded ? 9 : ph === "aim" ? 14 : 12;
  const lwMid = faded ? 5 : ph === "aim" ? 7.5 : 6;
  const lwInner = faded ? 1.75 : ph === "aim" ? 2.85 : 2.35;
  ctx.save();
  ctx.globalAlpha = faded ? 0.62 : 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.strokeStyle = blocked ? "#7f1d1d" : "#0f172a";
  ctx.lineWidth = lwOuter;
  ctx.stroke();
  ctx.strokeStyle = blocked ? "#f97316" : "#64748b";
  ctx.lineWidth = lwMid;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.strokeStyle = blocked ? "rgba(254,243,199,0.95)" : "rgba(255,255,255,0.78)";
  ctx.lineWidth = lwInner;
  ctx.stroke();
  ctx.restore();
}

function strokeHudText(text: string, x: number, y: number, align: CanvasTextAlign, sizePx: number): void {
  ctx.save();
  ctx.font = `900 ${sizePx}px ${HUD_FF}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = sizePx >= 13 ? 5 : 4;
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#fff";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Unten links: Munition & Blitz-Zeile (Canvas) */
function drawWeaponLoadoutHud(): void {
  const pad = 14;
  const rowTop = 30;
  const rowGap = 32;
  const titleSz = 16;
  const baseSz = 18;
  const selSz = 22;

  type HudRow = { row: "weapon"; slot: number; line: string } | { row: "shield"; line: string };
  const P = pw();
  const rows: HudRow[] = [];
  for (let idx = 0; idx < P.length; idx++) {
    const w = P[idx]!;
    const label = lockerMaxSpecialUnlocked() && idx === 3 ? `6. ${w.nameDe}` : `${idx + 1}. ${w.nameDe}`;
    rows.push({ row: "weapon", slot: idx, line: label });
  }
  rows.push({ row: "weapon", slot: blitzSlotIndex(), line: blitzLoadoutHudLine() });
  const sh = shieldLoadoutHudLine();
  if (sh) rows.push({ row: "shield", line: sh });

  ctx.save();
  ctx.font = `900 ${titleSz}px ${HUD_FF}`;
  const header = "Waffen wählen";
  let maxTw = ctx.measureText(header).width;
  for (const r of rows) {
    ctx.font = `900 ${baseSz}px ${HUD_FF}`;
    maxTw = Math.max(maxTw, ctx.measureText(r.line).width);
  }

  const boxW = Math.min(WORLD.W * 0.54, Math.max(maxTw + 52, 268));
  const boxH = rowTop + rows.length * rowGap + 18;
  const bx = pad;
  const by = WORLD.H - boxH - 14;

  pathRoundRect(bx, by, boxW, boxH, 18);
  ctx.fillStyle = "rgba(240,251,255,0.98)";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();

  strokeHudText(header, bx + boxW / 2, by + 22, "center", titleSz);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const isW = r.row === "weapon";
    const sel = isW && selectedSlot === r.slot;
    const dim = isW
      ? r.slot === blitzSlotIndex() && !canUseBlitzNow()
      : !(playerShieldAbsorb > 0 || canActivateDesertShieldNow());
    const ty = by + rowTop + i * rowGap + 8;
    ctx.save();
    if (dim) ctx.globalAlpha = 0.42;
    if (sel && !dim) {
      pathRoundRect(bx + 10, ty - selSz * 0.46, boxW - 20, selSz + 10, 12);
      ctx.fillStyle = "rgba(251,191,36,0.6)";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    strokeHudText(r.line, bx + 22, ty + selSz * (sel && !dim ? 0.06 : -0.04), "left", sel && !dim ? selSz : baseSz);
    ctx.restore();
  }

  ctx.restore();
}

/** Kurzer Hinweis bei Blitz (obere Mitte), große erste Zeile. */
function drawLightningBannerHud(now: number): void {
  if (now >= lightningBannerUntil || lightningBannerLines.length === 0) return;
  const l0 = lightningBannerLines[0]!;
  const l1 = lightningBannerLines[1] ?? "";
  const x = WORLD.W / 2;
  ctx.save();
  strokeHudText(l0, x, 76, "center", 30);
  if (l1) strokeHudText(l1, x, 118, "center", 18);
  ctx.restore();
}

function drawShieldBannerHud(now: number): void {
  if (now >= shieldBannerUntil || shieldBannerLines.length === 0) return;
  const l0 = shieldBannerLines[0]!;
  const l1 = shieldBannerLines[1] ?? "";
  const stackBlitz = now < lightningBannerUntil && lightningBannerLines.length > 0;
  const x = WORLD.W / 2;
  const y0 = stackBlitz ? 162 : 76;
  const y1 = stackBlitz ? 200 : 118;
  ctx.save();
  ctx.globalAlpha = 0.95;
  strokeHudText(l0, x, y0, "center", 26);
  if (l1) strokeHudText(l1, x, y1, "center", 16);
  ctx.restore();
}

function drawLightningBoltLayer(now: number): void {
  if (!lightningBolt) return;
  const lb = lightningBolt;
  const age = now - lb.t0;
  const maxBolt = LIGHTNING_BOLT_MS;
  if (age > maxBolt + 220) {
    lightningBolt = null;
    return;
  }
  const fade = Math.max(0.12, Math.min(1, 1.15 - age / (maxBolt + 200)));
  const { jagA, jagB } = lb;
  const n = jagA.length;
  if (n < 3 || jagB.length !== n) return;
  const topY = -4;
  const botY = Math.min(WORLD.H * 0.92, lb.gy + 2);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawTwinStroke = (jOffsets: readonly number[], alpha: number): void => {
    ctx.save();
    ctx.globalAlpha = fade * alpha;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = topY + (botY - topY) * t;
      const x = lb.cx + jOffsets[i]!;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 11;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(14,165,233,0.92)";
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = topY + (botY - topY) * t;
      const x = lb.cx + jOffsets[i]! * 0.72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#f0f9ff";
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.restore();
  };

  drawTwinStroke(jagA, 0.94);
  drawTwinStroke(jagB, 0.9);

  ctx.restore();
}

function phaseHintLine(): string {
  const s5 = canActivateDesertShieldNow() ? " · 5=Schild" : "";
  if (ph === "m") return `Fahren · Treibstoff ${fuelP}${s5}`;
  if (ph === "aim" && isBlitzSlot(selectedSlot))
    return `Blitz · von oben · A/D Platz · Klick · Leertaste${s5}`;
  if (ph === "aim") {
    const now = performance.now();
    const wall =
      !isBlitzSlot(selectedSlot) && playerBarrelLosBlocked()
        ? " · Rohr blockiert"
        : "";
    const bump = now < barrelBlockedHintUntil ? " · nicht schießbar" : "";
    return `Zielen · ${ang.toFixed(1)}° · Kraft ${Math.round(pow)}${s5}${wall}${bump}`;
  }
  if (ph === "pf" || ph === "bf") return "Flug…";
  return "Bot zielt …";
}

/** Wind, XP & Status — Comic-Sprechblase im Canvas (keine Kästen oben). */
function drawCartoonHudOverlay(nowMs: number): void {
  drawWeaponLoadoutHud();
  const pad = 12;
  const windLine = `${wa >= 0 ? "+" : ""}${wa.toFixed(1)} WIND`;
  const xpLine = `XP ${readXp()} · Lv ${levelFromXp(readXp())}`;
  ctx.save();
  ctx.font = `800 13px ${HUD_FF}`;
  const w1 = ctx.measureText(windLine).width;
  ctx.font = `800 11px ${HUD_FF}`;
  const w2 = ctx.measureText(xpLine).width;
  const bw = Math.max(w1, w2) + 46;
  const bh = 58;
  const bx = WORLD.W - bw - pad;
  const by = pad;
  pathRoundRect(bx, by, bw, bh, 15);
  ctx.fillStyle = "rgba(254,249,217,0.97)";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();
  strokeHudText(windLine, bx + bw / 2, by + 20, "center", 13);
  strokeHudText(xpLine, bx + bw / 2, by + 42, "center", 11);

  let msg = phaseHintLine();
  if (msg.length > 72) msg = `${msg.slice(0, 70)}…`;
  ctx.font = `800 13px ${HUD_FF}`;
  const mw = Math.min(WORLD.W - 28, ctx.measureText(msg).width + 56);
  const mh = 50;
  const mx = (WORLD.W - mw) / 2;
  const my = WORLD.H - mh - 14;
  pathRoundRect(mx, my, mw, mh, 18);
  ctx.fillStyle = "rgba(252,239,169,0.98)";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();
  strokeHudText(msg, mx + mw / 2, my + mh / 2 - 2, "center", 13);
  drawLightningBannerHud(nowMs);
  drawShieldBannerHud(nowMs);
  ctx.restore();
}

function paint(): void {
  const now = performance.now();
  const sk = shakeOffset(now);
  ctx.save();
  ctx.translate(sk.x, sk.y);

  drawSkyAndClouds(now);

  ctx.save();
  ctx.translate(-camX, 0);
  drawTerrainMass();
  drawDriveTrailParticlesLayer(now);
  drawAimTrajectoryPreview();
  drawPlayerTankPlaced(now);
  drawTankPlaced(bx, atlasRectForEnemySkin(enemyTankSkin), false);
  drawPlayerDesertShieldBubble();
  drawLifeBar(px, hullGroundY(px), hpP, battleMaxHp, "left");
  drawLifeBar(bx, hullGroundY(bx), hpB, battleMaxHp, "right");
  drawPlayerBarrelAim();
  drawMuzzleFlashes(now);

  const gFly = projectileInFlightStyle ?? DEFAULT_PROJECTILE_GLOW;
  const siPf = isBlitzSlot(selectedSlot) ? 0 : selectedSlot;
  const wpPf = pw()[siPf];
  const pbPreview = wpPf?.pelletBurst;
  const trailTone: "warm" | "dust" | "pellet" = pbPreview
    ? pbPreview.spreadHalfDeg >= 11
      ? "dust"
      : "pellet"
    : "warm";
  const pelletTrailSpan = pbPreview ? (pbPreview.spreadHalfDeg >= 11 ? 30 : 24) : 14;
  const pelletBulletScale = pbPreview ? (pbPreview.spreadHalfDeg >= 11 ? 0.62 : 0.58) : 0.48;

  if (ph === "pf" && playerPelletFlights?.length) {
    for (const pe of playerPelletFlights) {
      if (pe.applied || pe.pts.length < 2) continue;
      const j = Math.min(pe.ti, pe.pts.length - 1);
      drawSmokeTrailOnPath(pe.pts, j, pelletTrailSpan, trailTone);
      const p = pe.pts[j]!;
      const prev = j > 0 ? pe.pts[j - 1]! : null;
      drawProjectileSized(p, prev, gFly, pelletBulletScale);
    }
  } else if ((ph === "pf" || ph === "bf") && tr.length) {
    const j = Math.min(ti, tr.length - 1);
    drawSmokeTrailAhead(j);
    const p = tr[j]!;
    const prev = j > 0 ? tr[j - 1]! : null;
    drawProjectile(p, prev);
  }
  drawImpactBurstLayer(now);
  drawLightningBoltLayer(now);
  if (mapDifficulty === "insane") {
    drawInsaneFireAndSmoke(now);
  }
  ctx.restore();

  drawCartoonHudOverlay(now);
  if (mapDifficulty === "insane") drawInsaneEndOverlay();

  ctx.restore();
}

function finishPlayer(): void {
  projectileInFlightStyle = null;
  const si = isBlitzSlot(selectedSlot) ? 0 : selectedSlot;
  const Wp = pw()[si]!;
  const mu = mP(px, true);
  const v = velocityFromElevDeg(true, ang, pow, Wp.velMul);
  const hi = simulateUntilImpact(T, mu.x, mu.y, v.x, v.y, wa, FLIGHT_DT, weaponDragMul(Wp));
  spl(hi.x, hi.y, Wp);
  if (chk()) return;
  ph = 'bw';
  bWait = performance.now() + 650;
}

function finishBot(): void {
  projectileInFlightStyle = null;
  const Wb = WEAPONS[bwI]!;
  const mu = mB(bx, false, bθ);
  const v = velocityFromElevDeg(false, bθ, bPow, Wb.velMul);
  const hi = simulateUntilImpact(T, mu.x, mu.y, v.x, v.y, wa, FLIGHT_DT, weaponDragMul(Wb));
  spl(hi.x, hi.y, Wb);
  fuelB -= 6;
  if (chk()) return;
  ph = 'm';
  fuelP = playerFuelCapacity();
}

function chk(): boolean {
  if (hpB <= 0) {
    if (battleTestModeActive()) {
      openGameOverOverlay("win", 0);
      return true;
    }
    addXp(XP_WIN);
    const gems = rollGemsForWin(Math.random);
    addGems(gems);
    refreshPurseDisplays();
    openGameOverOverlay("win", gems);
    return true;
  }
  if (hpP <= 0) {
    openGameOverOverlay("lose");
    return true;
  }
  return false;
}

function pickBotShot(): void {
  const aimX = px;
  const aimY = pv(px) - 26;

  type Best = { err: number; wi: number; th: number; po: number };
  let best: Best = { err: Number.POSITIVE_INFINITY, wi: 1, th: 55, po: 700 };

  const evalShot = (wi: number, th: number, po: number): number => {
    const W = WEAPONS[wi]!;
    const v = velocityFromElevDeg(false, th, po, W.velMul);
    const mu = mB(bx, false, th);
    let eShot = 0;
    if (terrainBlocksBarrelRay(T, bx, pv(bx), th, false, BARREL_LEN_PX)) eShot += 2_800_000;
    const hi = simulateUntilImpact(T, mu.x, mu.y, v.x, v.y, wa, FLIGHT_DT, weaponDragMul(W));
    const dx = hi.x - aimX;
    const dy = hi.y - aimY;
    let e = dx * dx + dy * dy * 2.35;
    if (hi.x > px + 28) e += (hi.x - px - 28) * (hi.x - px - 28) * 6;
    if (hi.y > aimY + 140) e += 8200;
    return e + eShot;
  };

  for (let wi = 0; wi < WEAPONS.length; wi++) {
    for (let th = 36; th <= 80; th += 3.4) {
      for (let po = 430; po <= 1220; po += 38) {
        const e = evalShot(wi, th, po);
        if (e < best.err) best = { err: e, wi, th, po };
      }
    }
  }

  const w0 = best.wi;
  for (let dai = -4; dai <= 4; dai++) {
    for (let dpi = -4; dpi <= 4; dpi++) {
      const th = best.th + dai * 0.55;
      const po = best.po + dpi * 16;
      if (po < 400 || po > 1250 || th < 32 || th > 85) continue;
      const e = evalShot(w0, th, po);
      if (e < best.err) best = { err: e, wi: w0, th, po };
    }
  }
  for (let dai = -6; dai <= 6; dai++) {
    for (let dpi = -6; dpi <= 6; dpi++) {
      const th = best.th + dai * 0.1;
      const po = best.po + dpi * 3;
      if (po < 392 || po > 1260 || th < 30 || th > 86) continue;
      const e = evalShot(w0, th, po);
      if (e < best.err) best = { err: e, wi: w0, th, po };
    }
  }

  bwI = best.wi;
  bθ = best.th;
  bPow = best.po;

  botMuzzleExpire = performance.now() + 290;
  enemyBarrelVisDeg = bθ;

  const Wb = WEAPONS[bwI]!;
  const vv = velocityFromElevDeg(false, bθ, bPow, Wb.velMul);
  const mb = mB(bx, false, bθ);
  tr = flightPath(mb, vv.x, vv.y, weaponDragMul(Wb));
  ti = 0;
  enemyBarrelRecoilDeg = 6.1 + Math.min(4.4, bPow * 0.0035);
  projectileInFlightStyle = Wb.glow ?? DEFAULT_PROJECTILE_GLOW;
  ph = "bf";
}

function frame(): void {
  const nowFrame = performance.now();
  const hub = document.getElementById("taHub");
  if (hub && !hub.hidden) {
    requestAnimationFrame(frame);
    return;
  }
  hudTxt();
  if (surrenderStep === 0 && matchResult === null) {
    if (ph === "bw" && nowFrame > bWait) pickBotShot();
    tickBarrelVis();
    tickEnemyBarrelVis();
    tickCamera();
    tickDriveTrailParticles();
    if ((ph === "pf" || ph === "bf") && (playerPelletFlights?.length || tr.length)) {
      if (ph === "pf" && playerPelletFlights?.length) {
        const si = isBlitzSlot(selectedSlot) ? 0 : selectedSlot;
        const Wp = pw()[si]!;
        let matchEnd = false;
        let allDone = true;
        for (const pe of playerPelletFlights) {
          if (pe.applied) continue;
          allDone = false;
          if (pe.pts.length < 2) {
            spl(pe.hit.x, pe.hit.y, Wp);
            pe.applied = true;
            if (chk()) matchEnd = true;
            continue;
          }
          pe.ti = Math.min(pe.pts.length - 1, pe.ti + FLIGHT_FRAME_ADV);
          if (pe.ti >= pe.pts.length - 1) {
            spl(pe.hit.x, pe.hit.y, Wp);
            pe.applied = true;
            if (chk()) matchEnd = true;
          }
        }
        if (matchEnd) {
          playerPelletFlights = null;
          projectileInFlightStyle = null;
        } else if (allDone) {
          playerPelletFlights = null;
          projectileInFlightStyle = null;
          ph = "bw";
          bWait = nowFrame + 650;
        }
      } else if (tr.length) {
        ti = Math.min(tr.length - 1, ti + FLIGHT_FRAME_ADV);
        if (ti >= tr.length - 1) {
          if (ph === "pf") finishPlayer();
          else finishBot();
          tr = [];
          ti = 0;
        }
      }
    }
  }
  paint();
  requestAnimationFrame(frame);
}

function shopOverlayOpen(): boolean {
  const el = document.getElementById("taShop");
  return !!el && !el.hidden;
}

function lockerOverlayOpen(): boolean {
  const el = document.getElementById("taLocker");
  return !!el && !el.hidden;
}

function syncFortniteRail(): void {
  const s = shopOverlayOpen();
  const k = lockerOverlayOpen();
  document.getElementById("taHubTabLobby")?.classList.toggle("taHubNavBtn--active", !s && !k);
  document.getElementById("taHubTabShop")?.classList.toggle("taHubNavBtn--active", s);
  document.getElementById("taHubTabLocker")?.classList.toggle("taHubNavBtn--active", k);
}

function resumeLobbyTankIfNoOverlay(): void {
  if (!shopOverlayOpen() && !lockerOverlayOpen()) startLobbyTankShowcase();
}

function openShopOverlay(): void {
  const shop = document.getElementById("taShop");
  if (!shop || !shop.hidden) return;
  if (lockerOverlayOpen()) {
    const lk = document.getElementById("taLocker");
    if (lk) lk.hidden = true;
  }
  stopLobbyTankShowcase();
  hubShopLockerPreviewTankId = null;
  shop.hidden = false;
  syncFortniteRail();
  const st = document.getElementById("taShopTankMsg");
  if (st) st.textContent = "";
  const cMsg = document.getElementById("taShopCosmeticMsg");
  if (cMsg) cMsg.textContent = "";
  refreshPurseDisplays();
  startHubPreviewLoop();
  document.getElementById("taShopClose")?.focus();
}

function openLockerOverlay(): void {
  const locker = document.getElementById("taLocker");
  if (!locker || !locker.hidden) return;
  if (shopOverlayOpen()) {
    const sp = document.getElementById("taShop");
    if (sp) sp.hidden = true;
  }
  stopLobbyTankShowcase();
  hubShopLockerPreviewTankId = null;
  locker.hidden = false;
  syncFortniteRail();
  const uMsg = document.getElementById("taLockerUpgradeMsg");
  if (uMsg) uMsg.textContent = "";
  refreshPurseDisplays();
  startHubPreviewLoop();
  document.getElementById("taLockerClose")?.focus();
}

function collapseShopCodePanel(): void {
  const panel = document.getElementById("taShopCodePanel");
  const toggle = document.getElementById("taShopCodeToggle");
  const msg = document.getElementById("taShopCodeMsg");
  const input = document.getElementById("taShopCodeInput") as HTMLInputElement | null;
  if (panel) panel.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  if (msg) msg.textContent = "";
  if (input) input.value = "";
}

let promoApplyInFlight = false;

function promoNetworkHint(endpoint: string): string {
  try {
    const loc =
      typeof globalThis !== "undefined" && "location" in globalThis ? (globalThis as { location?: Location }).location : undefined;
    if (loc?.protocol === "https:" && endpoint.trimStart().startsWith("http:")) {
      return "Promo-Adresse muss mit https:// beginnen (von einer sicheren Seite aus wird http:// geblockt).";
    }
  } catch {
    /** ignore */
  }
  if (/127\.|localhost/i.test(endpoint)) {
    if (isLocalTankArtilleryPromoHost()) {
      return "Promo-Stub erreicht nicht — im Projekt `npm run promo-stub` starten (Port 5799) und Seite neu laden, dann erneut einlösen.";
    }
    return "Die Server-Adresse zeigt auf diesen Computer (localhost/127…) — vom Internet-Host aus nicht erreichbar.";
  }
  return "Keine Verbindung zum Promo-Server (DNS, Firewall, falsche URL oder Worker offline).";
}

async function applyPromoFromShopUi(): Promise<void> {
  const input = document.getElementById("taShopCodeInput") as HTMLInputElement | null;
  const msg = document.getElementById("taShopCodeMsg");
  const btn = document.getElementById("taShopCodeApply") as HTMLButtonElement | null;
  if (!input || !msg || promoApplyInFlight) return;

  const trimmed = input.value.trim();
  if (trimmed.length > 0 && unlockAdminGems(trimmed)) {
    msg.textContent = "💎 ohne Limit aktiv (dieser Browser). Shop nutzen wie gewohnt.";
    refreshPurseDisplays();
    input.value = "";
    return;
  }

  const r = describePromoRedeem(input.value, readPromoUsedKeys());
  if (!r.ok) {
    if (r.reason === "used") {
      msg.textContent = "Der Code wurde schon eingelöst.";
    } else {
      msg.textContent = "Ungültiger Code.";
    }
    return;
  }

  if (promoSkipsGlobalSlotReserve(r.key)) {
    if (typeof r.gems === "number") addGems(r.gems);
    if (typeof r.xp === "number") addXp(r.xp);
    addPromoUsedKey(r.key);
    refreshPurseDisplays();
    msg.textContent =
      typeof r.gems === "number"
        ? `+${r.gems} 💎 — eingelöst!`
        : typeof r.xp === "number"
          ? `+${r.xp} XP — eingelöst!`
          : "Eingelöst!";
    input.value = "";
    return;
  }

  const endpoint = promoClaimEndpoint();
  if (!endpoint) {
    msg.textContent =
      "Promo nicht erreichbar: Beim Hosting `VITE_TANK_PROMO_CLAIM_URL=https://…/claim` (HTTPS) setzen — oder vor dem Laden `window.__TANK_PROMO_CLAIM_URL__` setzen.";
    return;
  }

  promoApplyInFlight = true;
  if (btn) btn.disabled = true;
  msg.textContent = "Slot wird geprüft …";
  try {
    const slot = await reservePromoGlobalSlot(endpoint);
    if (slot === "full") {
      msg.textContent = "Alle drei weltweiten Promo-Plätze sind schon vergeben.";
      return;
    }
    if (slot === "network_error") {
      msg.textContent = promoNetworkHint(endpoint);
      return;
    }
    if (slot !== "ok") {
      msg.textContent =
        "Promo-Server antwortet ungewöhnlich (/claim mit JSON { ok:true } erwarten — URL oder Worker prüfen).";
      return;
    }
    if (typeof r.gems === "number") addGems(r.gems);
    if (typeof r.xp === "number") addXp(r.xp);
    addPromoUsedKey(r.key);
    refreshPurseDisplays();
    msg.textContent =
      typeof r.gems === "number"
        ? `+${r.gems} 💎 — eingelöst!`
        : typeof r.xp === "number"
          ? `+${r.xp} XP — eingelöst!`
          : "Eingelöst!";
    input.value = "";
  } finally {
    promoApplyInFlight = false;
    if (btn) btn.disabled = false;
  }
}

function closeShopOverlay(): void {
  const shop = document.getElementById("taShop");
  if (!shop) return;
  collapseShopCodePanel();
  if (shop.hidden) return;
  shop.hidden = true;
  stopHubPreviewLoop();
  hubShopLockerPreviewTankId = null;
  syncFortniteRail();
  resumeLobbyTankIfNoOverlay();
}

function closeLockerOverlay(): void {
  const locker = document.getElementById("taLocker");
  if (!locker || locker.hidden) return;
  locker.hidden = true;
  stopHubPreviewLoop();
  hubShopLockerPreviewTankId = null;
  syncFortniteRail();
  resumeLobbyTankIfNoOverlay();
}

/** Overlays vor dem Kampf ausblenden (kein Showcase-Restart). */
function hideHubOverlaysForGame(): void {
  const shop = document.getElementById("taShop");
  const locker = document.getElementById("taLocker");
  collapseShopCodePanel();
  if (shop) shop.hidden = true;
  if (locker) locker.hidden = true;
  stopHubPreviewLoop();
  hubShopLockerPreviewTankId = null;
  syncFortniteRail();
}

function setHubTab(which: "lobby" | "shop" | "locker"): void {
  if (which === "lobby") {
    closeShopOverlay();
    closeLockerOverlay();
  } else if (which === "shop") openShopOverlay();
  else openLockerOverlay();
}

let rafStarted = false;

function enterGameFromHub(): void {
  hideHubOverlaysForGame();
  stopLobbyTankShowcase();
  document.getElementById("taHub")!.hidden = true;
  document.getElementById("taStage")!.removeAttribute("hidden");
  document.getElementById("taBottom")!.removeAttribute("hidden");
  if (skipBeginOnceOnEnterGame) {
    skipBeginOnceOnEnterGame = false;
  } else {
    begin();
  }
  hudTxt();
  cv.focus();
  if (!rafStarted) {
    rafStarted = true;
    requestAnimationFrame(frame);
  }
  syncBattleTestLeaveUi();
}

function syncFullscreenControl(): void {
  const btn = document.getElementById("taFullscreenBtn") as HTMLButtonElement | null;
  const root = document.getElementById("taRoot");
  if (!btn || !root) return;
  const on = currentFullscreenElement(document) === root;
  const s = fullscreenToggleStrings(on);
  btn.textContent = s.text;
  btn.setAttribute("aria-label", s.ariaLabel);
  btn.title = s.title;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

document.addEventListener("DOMContentLoaded", () => {
  cv = document.getElementById("taCanvas") as HTMLCanvasElement;
  cv.tabIndex = 0;
  cv.setAttribute("aria-label", "Panzer-Artillerie");
  ctx = cv.getContext("2d")!;
  lobbyTankCv = document.getElementById("taLobbyTankCanvas") as HTMLCanvasElement | null;
  lobbyTankCx = lobbyTankCv?.getContext("2d") ?? null;
  refreshPurseDisplays();
  cacheDefaultLobbyLeadShort();
  wireMapPrefsFromLobby();

  const taRootEl = document.getElementById("taRoot") as HTMLElement | null;
  document.getElementById("taFullscreenBtn")?.addEventListener("click", () => {
    if (!taRootEl) return;
    void toggleRootFullscreen(taRootEl).finally(() => syncFullscreenControl());
  });
  document.addEventListener("fullscreenchange", syncFullscreenControl);
  document.addEventListener("webkitfullscreenchange", syncFullscreenControl as EventListener);
  syncFullscreenControl();

  document.getElementById("taHubTabLobby")?.addEventListener("click", () => setHubTab("lobby"));
  document.getElementById("taHubTabShop")?.addEventListener("click", () => setHubTab("shop"));
  document.getElementById("taHubTabLocker")?.addEventListener("click", () => setHubTab("locker"));
  document.getElementById("taHubPlay")?.addEventListener("click", enterGameFromHub);

  const onShopBackdropOrClose = () => closeShopOverlay();
  document.getElementById("taShopBackdrop")?.addEventListener("click", onShopBackdropOrClose);
  document.getElementById("taShopClose")?.addEventListener("click", onShopBackdropOrClose);
  document.getElementById("taShopCloseFoot")?.addEventListener("click", onShopBackdropOrClose);

  document.getElementById("taShopCodeToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("taShopCodePanel");
    const toggle = document.getElementById("taShopCodeToggle") as HTMLButtonElement | null;
    if (!panel || !toggle) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
    if (opening) {
      document.getElementById("taShopCodeInput")?.focus();
    }
  });

  document.getElementById("taShopCodeApply")?.addEventListener("click", () => {
    void applyPromoFromShopUi();
  });
  document.getElementById("taShopCodeInput")?.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).code === "Enter") {
      (ev as KeyboardEvent).preventDefault();
      void applyPromoFromShopUi();
    }
  });

  const onLockerBackdropOrClose = () => closeLockerOverlay();
  document.getElementById("taLockerBackdrop")?.addEventListener("click", onLockerBackdropOrClose);
  document.getElementById("taLockerClose")?.addEventListener("click", onLockerBackdropOrClose);
  document.getElementById("taLockerCloseFoot")?.addEventListener("click", onLockerBackdropOrClose);

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (shopOverlayOpen()) {
      e.preventDefault();
      closeShopOverlay();
      document.getElementById("taHubTabShop")?.focus();
      return;
    }
    if (lockerOverlayOpen()) {
      e.preventDefault();
      closeLockerOverlay();
      document.getElementById("taHubTabLocker")?.focus();
    }
  });

  document.getElementById("taBattleTestLeaveBtn")?.addEventListener("click", () => leaveBattleTestToLobby());

  document.getElementById("taSurrenderJa")?.addEventListener("click", onSurrenderJa);
  document.getElementById("taSurrenderNein")?.addEventListener("click", onSurrenderNein);
  document.getElementById("taSurrenderBackdrop")?.addEventListener("click", onSurrenderNein);
  document.getElementById("taGameOverBtn")?.addEventListener("click", handleGameOverPlayAgain);
  document.getElementById("taGameOverLobbyBtn")?.addEventListener("click", handleGameOverWinToLobby);
  document.getElementById("taGameOverBackdrop")?.addEventListener("click", handleGameOverBackdropClick);

  loadSpritesheet(() => {
    refreshPurseDisplays();
    const playBtn = document.getElementById("taHubPlay") as HTMLButtonElement | null;
    if (playBtn) playBtn.disabled = false;
    startLobbyTankShowcase();
  });
  cv.addEventListener(
    "pointerdown",
    (e) => {
      const hubHidden = !!document.getElementById("taHub")?.hidden;
      const stageEl = document.getElementById("taStage") as HTMLElement | null;
      if (hubHidden && stageEl && !stageEl.hidden) cv.focus();

      if (surrenderStep !== 0 || matchResult !== null) return;
      if (ph !== "aim" || !isBlitzSlot(selectedSlot)) return;
      const rect = cv.getBoundingClientRect();
      blitzStrikeX = camX + ((e.clientX - rect.left) / rect.width) * VIEW_W;
      clampBlitzAim();
      e.preventDefault();
    },
    { passive: false },
  );
  function tankBattleKeysActive(e: KeyboardEvent): boolean {
    if (shopOverlayOpen() || lockerOverlayOpen()) return false;
    const hub = document.getElementById("taHub");
    if (hub && !hub.hidden) return false;
    const stage = document.getElementById("taStage");
    if (!stage || stage.hidden) return false;
    const t = e.target;
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      (t instanceof HTMLElement && t.isContentEditable)
    ) {
      return false;
    }
    return true;
  }

  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (!tankBattleKeysActive(e)) return;
      if (surrenderStep !== 0) {
        if (e.code === "Escape") {
          e.preventDefault();
          closeSurrenderDialog();
        }
        return;
      }
      if (matchResult !== null) {
        /** Sieg: zwei Buttons — Aktivierung nur per Fokus, kein zweiter Pfad über Leertaste. */
        if (matchResult !== "win" && (e.code === "Enter" || e.code === "Space")) {
          e.preventDefault();
          handleGameOverPlayAgain();
        }
        return;
      }
      if (battleTestModeActive() && e.code === "Escape") {
        e.preventDefault();
        leaveBattleTestToLobby();
        return;
      }
      if (hpP <= 0 || hpB <= 0) return;
      if (e.code === "KeyR") {
        e.preventDefault();
        openSurrenderDialog();
        return;
      }
      if (ph === 'm') {
        if (e.code === "Digit5" && tryActivateDesertShieldFromKeys()) {
          e.preventDefault();
          return;
        }
        /** Nur Pfeile fahren — A/D bleiben für die Zielphase frei */
        if (e.code === 'ArrowLeft' && fuelP > 9) {
          if (movePlayerTank(-5)) fuelP -= 9;
          e.preventDefault();
        }
        if (e.code === 'ArrowRight' && fuelP > 9) {
          if (movePlayerTank(5)) fuelP -= 9;
          e.preventDefault();
        }
        if (e.code === 'Enter') {
          ph = 'aim';
        }
        return;
      }
      if (ph === 'aim') {
        if (e.code === "Digit1") selectedSlot = 0;
        if (e.code === "Digit2") selectedSlot = 1;
        if (e.code === "Digit3") selectedSlot = 2;
        if (e.code === "Digit4" && canUseBlitzNow()) {
          e.preventDefault();
          selectedSlot = blitzSlotIndex();
          refreshBlitzAimAroundTanks();
          return;
        }
        if (e.code === "Digit6" && lockerMaxSpecialUnlocked()) {
          e.preventDefault();
          selectedSlot = 3;
          return;
        }
        if (e.code === "Digit5" && tryActivateDesertShieldFromKeys()) {
          e.preventDefault();
          return;
        }

        const fine = e.shiftKey;
        if (isBlitzSlot(selectedSlot)) {
          const stepCx = fine ? 11 : 30;
          if (e.code === "KeyA" || e.code === "ArrowLeft") {
            blitzStrikeX -= stepCx;
            e.preventDefault();
          }
          if (e.code === "KeyD" || e.code === "ArrowRight") {
            blitzStrikeX += stepCx;
            e.preventDefault();
          }
          clampBlitzAim();

          if (e.code === "Space") {
            e.preventDefault();
            if (!canUseBlitzNow()) return;
            const t0 = performance.now();
            applySkyBolt(t0);
            selectedSlot = 0;
            if (chk()) return;
            ph = "bw";
            bWait = t0 + 650;
          }
          return;
        }

        const dAng = fine ? 0.22 : 0.62;
        const dPow = fine ? 4 : 11;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') ang -= dAng;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') ang += dAng;
        ang = Math.max(18, Math.min(86, ang));
        if (e.code === 'KeyW' || e.code === 'ArrowUp') pow += dPow;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') pow -= dPow;
        pow = Math.max(PLAYER_POW_MIN, Math.min(playerPowMax(), pow));
        if (e.code === "Space") {
          e.preventDefault();
          if (playerBarrelLosBlocked()) {
            barrelBlockedHintUntil = performance.now() + 900;
            return;
          }
          barrelVisAng = ang;
          barrelVisVel *= 0.38;
          barrelRecoilDeg = 8.8 + Math.min(6.2, pow * 0.0042);
          muzzleExpire = performance.now() + 300;
          const Wp = pw()[selectedSlot]!;
          const pb = Wp.pelletBurst;
          const mu = mP(px, true);
          projectileInFlightStyle = Wp.glow ?? DEFAULT_PROJECTILE_GLOW;
          if (pb && pb.count >= 2) {
            playerPelletFlights = [];
            for (let n = 0; n < pb.count; n++) {
              const v = jitteredShotVelocity(true, ang, pow, Wp.velMul, pb.spreadHalfDeg, roll);
              const pts = flightPath(mu, v.x, v.y, weaponDragMul(Wp));
              const hit = simulateUntilImpact(T, mu.x, mu.y, v.x, v.y, wa, FLIGHT_DT, weaponDragMul(Wp));
              playerPelletFlights.push({ pts, hit, ti: 0, applied: false });
            }
            tr = [];
            ti = 0;
          } else {
            playerPelletFlights = null;
            const v = velocityFromElevDeg(true, ang, pow, Wp.velMul);
            tr = flightPath(mu, v.x, v.y, weaponDragMul(Wp));
            ti = 0;
          }
          ph = "pf";
        }
        return;
      }
    },
    true,
  );

  if (import.meta.env.DEV) {
    window.__TA_DEV_SHOW_WIN_MENU__ = (): void => {
      openGameOverOverlay("win", 99);
    };
  }
});

