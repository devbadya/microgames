import { expect, test, vi } from "vitest";
import {
  addGems,
  applyCrater,
  BLITZ_DISPLAY_NAME_DE,
  buildTerrain,
  DEFAULT_HP,
  GEM_PRICE_TANK_DESERT,
  GEM_PRICE_TANK_BUNKER,
  GEM_PRICE_TANK_CRIMSON,
  DESERT_SHIELD_PRICE_GEMS,
  DESERT_SHIELD_ABSORB,
  DESERT_SHIELD_STORAGE_KEY,
  GEM_PRICE_TANK_GREEN,
  GEM_PRICE_TANK_NAVY,
  GEM_PRICE_TANK_VIPER,
  getPlayerTankDef,
  MAP_BATTLE_THEME_STORAGE_KEY,
  MAP_DIFFICULTY_STORAGE_KEY,
  readMapBattleTheme,
  readMapDifficulty,
  setMapBattleTheme,
  setMapDifficulty,
  readEquippedTankId,
  readOwnedTankIds,
  setEquippedTankId,
  GEM_STORAGE_KEY,
  TANK_STORAGE_OWNED,
  TANK_STORAGE_EQUIPPED,
  XP_STORAGE_KEY,
  tryBuyTank,
  tryBuyDesertShield,
  readDesertShieldOwned,
  readDesertShieldCharges,
  MOVE_TRAIL_OWNED_KEY,
  MOVE_TRAIL_EQUIPPED_KEY,
  MOVE_TRAIL_FIRE_PRICE_GEMS,
  MOVE_TRAIL_RAINBOW_PRICE_GEMS,
  readEquippedMoveTrail,
  readOwnedMoveTrailIds,
  setEquippedMoveTrail,
  tryBuyMoveTrailCosmetic,
  consumeDesertShieldActivation,
  DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE,
  LOCKER_UPGRADES_STORAGE_KEY,
  LOCKER_UPGRADE_MAX_LEVEL,
  readLockerUpgradeLevels,
  readLockerUpgradeLevelsFor,
  readLockerUpgradeMap,
  tryBuyLockerUpgrade,
  lockerUpgradeStepCostGems,
  lockerUpgradeFuelBonus,
  lockerUpgradeDamageMul,
  lockerUpgradePowMaxDelta,
  getWeapon,
  lockerMaxBonusWeaponFor,
  lockerMaxSpecialAttackUnlocked,
  VIPER_GIFT_BOMB_WEAPON,
  heightAt,
  terrainBlocksBarrelRay,
  terrainHullPose,
  levelFromXp,
  LIGHTNING_CRATER_DEPTH,
  LIGHTNING_CRATER_PX,
  LIGHTNING_DAMAGE,
  LIGHTNING_SPLASH_PX,
  readGems,
  readXp,
  spendGems,
  ADMIN_GEMS_UNLOCK_STORAGE_KEY,
  unlockAdminGems,
  adminGemsUnlocked,
  GEM_WIN_MAX,
  GEM_WIN_MIN,
  rollGemsForWin,
  sampleTrajectory,
  simulateUntilImpact,
  splashDamage,
  velocityFromElevDeg,
  jitteredShotVelocity,
  describePromoRedeem,
  isLocalTankArtilleryPromoHost,
  normalizePromoCode,
  promoSkipsGlobalSlotReserve,
  reservePromoGlobalSlot,
  PROMO_GEMS_PER_CODE,
  PROMO_GLOBAL_MAX_SLOTS,
  WEAPONS,
  TANK_HALF_H,
  TANK_HALF_W,
  WORLD,
  type TerrainSurface,
} from "./artillery-logic";

test("terrainBlocksBarrelRay true when ridge crosses bore line", () => {
  const w = 800;
  const y = new Float32Array(w);
  y.fill(430);
  for (let xi = 130; xi < 220; xi++) y[xi] = 318;
  const surf: TerrainSurface = { y };
  const blocked = terrainBlocksBarrelRay(surf, 100, 394, 38, true, 61, { marginPx: 4, sampleStep: 2 });
  expect(blocked).toBe(true);
});

test("terrainBlocksBarrelRay false for steep shot over ridge", () => {
  const w = 800;
  const y = new Float32Array(w);
  y.fill(430);
  for (let xi = 130; xi < 220; xi++) y[xi] = 318;
  const surf: TerrainSurface = { y };
  const clear = terrainBlocksBarrelRay(surf, 100, 394, 72, true, 61, { marginPx: 4, sampleStep: 2 });
  expect(clear).toBe(false);
});

test("terrainBlocksBarrelRay for right-facing tank (enemy)", () => {
  const w = 800;
  const y = new Float32Array(w);
  y.fill(430);
  for (let xi = 580; xi < 670; xi++) y[xi] = 318;
  const surf: TerrainSurface = { y };
  const blocked = terrainBlocksBarrelRay(surf, 700, 394, 38, false, 61, { marginPx: 4, sampleStep: 2 });
  expect(blocked).toBe(true);
});

test("terrainHullPose keeps hull support line above jagged terrain", () => {
  const w = 400;
  const y = new Float32Array(w);
  y.fill(420);
  for (let xi = 190; xi < 230; xi++) y[xi] = 365;
  for (let xi = 245; xi < 270; xi++) y[xi] = 455;
  const surf: TerrainSurface = { y };
  const pose = terrainHullPose(surf, 230, 44, { maxSlopeRad: Math.PI / 9, sampleCount: 11 });
  const tan = Math.tan(pose.slope);
  for (let i = 0; i < 11; i++) {
    const x = 186 + (88 * i) / 10;
    const supportY = pose.groundY + tan * (x - 230);
    expect(supportY + 0.001).toBeGreaterThanOrEqual(heightAt(surf, x));
  }
  expect(Math.abs(pose.slope)).toBeLessThanOrEqual(Math.PI / 9);
  expect(pose.maxClearancePx).toBeGreaterThan(0);
});

test("terrainHullPose clamps extreme cliff tilt", () => {
  const w = 300;
  const y = new Float32Array(w);
  y.fill(430);
  for (let xi = 150; xi < w; xi++) y[xi] = 260;
  const surf: TerrainSurface = { y };
  const pose = terrainHullPose(surf, 150, 44, { maxSlopeRad: 0.22, sampleCount: 9 });
  expect(Math.abs(pose.rawSlope)).toBeGreaterThan(0.22);
  expect(Math.abs(pose.slope)).toBeLessThanOrEqual(0.22);
});

test("terrain build + height interpolation", () => {
  const t = buildTerrain(9001);
  expect(t.y.length).toBe(WORLD.W);
  expect(heightAt(t, 120.75)).toBeGreaterThan(0);
  expect(heightAt(t, WORLD.W)).toBeTruthy();
});

test("simulateUntilImpact lands near terrain height", () => {
  const t = buildTerrain(4242);
  const imp = simulateUntilImpact(t, 120, heightAt(t, 120) - 160, 280, -320, -9, 1 / 200);
  const localG = heightAt(t, imp.x);
  expect(Math.abs(imp.y - localG)).toBeLessThan(5);
});

test("higher ballisticDragMul shortens forward reach (same shot)", () => {
  const t = buildTerrain(55_432);
  const x0 = 200;
  const y0 = heightAt(t, x0) - 140;
  const wind = 2;
  const loose = simulateUntilImpact(t, x0, y0, 580, -400, wind, 1 / 200, 0.35);
  const tight = simulateUntilImpact(t, x0, y0, 580, -400, wind, 1 / 200, 2.8);
  expect(tight.x).toBeLessThan(loose.x);
});

test("sampleTrajectory last point matches simulateUntilImpact (same dt and drag)", () => {
  const t = buildTerrain(77);
  const x0 = 300;
  const y0 = heightAt(t, x0) - 120;
  const v = velocityFromElevDeg(true, 52, 700, 1);
  const dragMul = 1;
  const dt = 1 / 180;
  const imp = simulateUntilImpact(t, x0, y0, v.x, v.y, -4, dt, dragMul);
  const pts = sampleTrajectory(t, x0, y0, v.x, v.y, -4, 8000, dt, dragMul);
  const last = pts[pts.length - 1]!;
  expect(Math.abs(last.x - imp.x)).toBeLessThan(16);
  expect(Math.abs(last.y - imp.y)).toBeLessThan(20);
});

function altitudeRange(surface: TerrainSurface): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = 0; x < WORLD.W; x++) {
    const v = surface.y[x]!;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return hi - lo;
}

test("buildTerrain: Schwierigkeit hard hat mehr Relief als easy (gleicher Seed)", () => {
  const seed = 402_917;
  const easyR = altitudeRange(buildTerrain(seed, { difficulty: "easy" }));
  const hardR = altitudeRange(buildTerrain(seed, { difficulty: "hard" }));
  expect(hardR).toBeGreaterThan(easyR * 1.06);
});

test("buildTerrain: Schwierigkeit insane hat mehr Relief als hard (gleicher Seed)", () => {
  const seed = 402_917;
  const hardR = altitudeRange(buildTerrain(seed, { difficulty: "hard" }));
  const insaneR = altitudeRange(buildTerrain(seed, { difficulty: "insane" }));
  expect(insaneR).toBeGreaterThan(hardR * 1.06);
});

test("buildTerrain: normal entspricht früherem Standard (ohne Options)", () => {
  const seed = 55_055;
  const legacy = buildTerrain(seed);
  const normal = buildTerrain(seed, { difficulty: "normal" });
  expect(legacy.y.every((v, i) => v === normal.y[i])).toBe(true);
});

test("readMapDifficulty / Theme: Defaults und Persistenz", () => {
  const ls = globalThis.localStorage;
  if (!ls || typeof ls.removeItem !== "function") return;
  ls.removeItem(MAP_DIFFICULTY_STORAGE_KEY);
  ls.removeItem(MAP_BATTLE_THEME_STORAGE_KEY);
  expect(readMapDifficulty()).toBe("normal");
  expect(readMapBattleTheme()).toBe("earth");
  setMapDifficulty("hard");
  setMapBattleTheme("moon");
  expect(readMapDifficulty()).toBe("hard");
  expect(readMapBattleTheme()).toBe("moon");
  expect(ls.getItem(MAP_DIFFICULTY_STORAGE_KEY)).toBe("hard");
  setMapDifficulty("insane");
  expect(readMapDifficulty()).toBe("insane");
  setMapDifficulty("invalid");
  expect(readMapDifficulty()).toBe("normal");
  setMapBattleTheme("luna");
  expect(readMapBattleTheme()).toBe("earth");
  ls.removeItem(MAP_DIFFICULTY_STORAGE_KEY);
  ls.removeItem(MAP_BATTLE_THEME_STORAGE_KEY);
});

test("velocityFromElevDeg directional", () => {
  const vl = velocityFromElevDeg(true, 45, 460, WEAPONS[0]!.velMul);
  expect(vl.x > 40).toBe(true);
  const vr = velocityFromElevDeg(false, 45, 460, WEAPONS[0]!.velMul);
  expect(vr.x < -40).toBe(true);
});

test("splashDamage peak at center zero off", () => {
  const d = splashDamage(100, 200, 100, 200, TANK_HALF_W, TANK_HALF_H, 64, 100);
  expect(d > 68).toBe(true);
  expect(splashDamage(400, 200, 100, 200, TANK_HALF_W, TANK_HALF_H, 64, 100)).toBe(0);
});

test("Blitz-Schaden-Spitze liegt bei LIGHTNING_DAMAGE am Trefferzentrum", () => {
  const cx = 500;
  const tankBase = 440;
  const cy = tankBase - TANK_HALF_H;
  /** Explosion direkt auf die Panzer-Mitte (wie splashDamage-Rechteck verwendet wird) */
  const peak = Math.round(
    splashDamage(cx, cy, cx, tankBase, TANK_HALF_W, TANK_HALF_H, LIGHTNING_SPLASH_PX, LIGHTNING_DAMAGE),
  );
  expect(peak).toBe(LIGHTNING_DAMAGE);
});

test("sampleTrajectory produces terminating path", () => {
  const t = buildTerrain(33);
  const x0 = 400;
  const y0 = heightAt(t, x0) - 130;
  const v = velocityFromElevDeg(true, 54, 480, WEAPONS[0]!.velMul);
  const pts = sampleTrajectory(t, x0, y0, v.x, v.y, 3, 280, 1 / 140, 1);
  expect(pts.length).toBeGreaterThan(10);
});

test("applyCrater digs surface downward locally", () => {
  const t = buildTerrain(777);
  const x = 300;
  const before = heightAt(t, x);
  applyCrater(t, x, 40, 30);
  const after = heightAt(t, x);
  expect(after > before).toBe(true);
});

test("lightning-scale crater digs much deeper than a normal shell", () => {
  const t = buildTerrain(12_901);
  const x = 600;
  const before = heightAt(t, x);
  applyCrater(t, x, LIGHTNING_CRATER_PX, LIGHTNING_CRATER_DEPTH);
  const after = heightAt(t, x);
  expect(after - before).toBeGreaterThan(120);
});

test("weapon display names (Deutsch) and Blitz label", () => {
  expect(WEAPONS.every((w) => w.nameDe.length >= 2)).toBe(true);
  expect(BLITZ_DISPLAY_NAME_DE).toBe("Blitz");
});

test("getWeapon wraps indexes", () => {
  expect(getWeapon(0)?.id).toBe(WEAPONS[0]?.id);
  expect(getWeapon(WEAPONS.length * 10 + 1)?.id).toBe(WEAPONS[1]?.id);
});

test("levelFromXp curve", () => {
  expect(levelFromXp(0)).toBe(1);
  expect(levelFromXp(160)).toBe(3);
  expect(levelFromXp(-10)).toBe(1);
});

test("readXp: keine Zahl in localStorage → 0", () => {
  try {
    localStorage.setItem(XP_STORAGE_KEY, "kein-xp");
  } catch {
    return;
  }
  try {
    expect(readXp()).toBe(0);
  } finally {
    localStorage.removeItem(XP_STORAGE_KEY);
  }
});

test("rollGemsForWin yields 50..120 inclusive at distribution edges", () => {
  expect(rollGemsForWin(() => 0)).toBe(GEM_WIN_MIN);
  expect(rollGemsForWin(() => 0.999_999_999_999)).toBe(GEM_WIN_MAX);
  expect(rollGemsForWin(() => 0.5)).toBeGreaterThanOrEqual(GEM_WIN_MIN);
  expect(rollGemsForWin(() => 0.5)).toBeLessThanOrEqual(GEM_WIN_MAX);
});

test("readGems / addGems mit localStorage", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
  } catch {
    /** Umgebungen ohne LS */
    return;
  }
  expect(readGems()).toBe(0);
  expect(addGems(15)).toBe(15);
  expect(readGems()).toBe(15);
  expect(addGems(3)).toBe(18);
  expect(readGems()).toBe(18);
  localStorage.removeItem(GEM_STORAGE_KEY);
});

test("normalizePromoCode trimmt und lowercaset", () => {
  expect(normalizePromoCode("  Admin1  ")).toBe("admin1");
  expect(normalizePromoCode("ADMIN 2")).toBe("admin2");
});

test("Promo-Konstanten — alle Codes gleich viele Gems, max. 3 globale Slots", () => {
  expect(PROMO_GEMS_PER_CODE).toBe(600);
  expect(PROMO_GLOBAL_MAX_SLOTS).toBe(3);
});

test("describePromoRedeem: gültig, unbekannt, bereits verwendet", () => {
  const fresh = new Set<string>();
  expect(describePromoRedeem("Admin3", fresh)).toEqual({ ok: true, key: "admin3", gems: PROMO_GEMS_PER_CODE });
  expect(describePromoRedeem("Admin2", fresh)).toEqual({ ok: true, key: "admin2", gems: PROMO_GEMS_PER_CODE });
  expect(describePromoRedeem("nope", fresh)).toEqual({ ok: false, reason: "unknown" });
  const used = new Set<string>(["admin1"]);
  expect(describePromoRedeem("Admin1", used)).toEqual({ ok: false, reason: "used" });
});

test("describePromoRedeem: Seba1 nur auf Loopback, sonst ungültig", () => {
  const fresh = new Set<string>();
  vi.stubGlobal(
    "location",
    { hostname: "pages.github.io", href: "https://pages.github.io/", pathname: "/" } as Location,
  );
  try {
    expect(describePromoRedeem("Seba1", fresh)).toEqual({ ok: false, reason: "unknown" });
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "localhost" } as Location);
  try {
    expect(describePromoRedeem(" Seba1 ", fresh)).toEqual({ ok: true, key: "seba1", gems: 10_000 });
    expect(describePromoRedeem("Seba1", new Set(["seba1"]))).toEqual({ ok: false, reason: "used" });
  } finally {
    vi.unstubAllGlobals();
  }
});

test("describePromoRedeem: AdminS/admins nur auf Loopback, 1M Gems", () => {
  const fresh = new Set<string>();
  vi.stubGlobal("location", { hostname: "example.com" } as Location);
  try {
    expect(describePromoRedeem("AdminS", fresh)).toEqual({ ok: false, reason: "unknown" });
    expect(describePromoRedeem("admins", fresh)).toEqual({ ok: false, reason: "unknown" });
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "localhost" } as Location);
  try {
    expect(describePromoRedeem(" AdminS ", fresh)).toEqual({ ok: true, key: "admins", gems: 1_000_000 });
    expect(describePromoRedeem("admins", new Set(["admins"]))).toEqual({ ok: false, reason: "used" });
  } finally {
    vi.unstubAllGlobals();
  }
});

test("describePromoRedeem: sebaxp nur auf Loopback, gibt 10k XP", () => {
  const fresh = new Set<string>();
  vi.stubGlobal("location", { hostname: "pages.github.io" } as Location);
  try {
    expect(describePromoRedeem("sebaxp", fresh)).toEqual({ ok: false, reason: "unknown" });
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "127.0.0.1" } as Location);
  try {
    expect(describePromoRedeem(" sebaxp ", fresh)).toEqual({ ok: true, key: "sebaxp", xp: 10_000 });
    expect(describePromoRedeem("sebaxp", new Set(["sebaxp"]))).toEqual({ ok: false, reason: "used" });
  } finally {
    vi.unstubAllGlobals();
  }
});

test("isLocalTankArtilleryPromoHost: localhost und 127 vs Remote", () => {
  vi.stubGlobal("location", { hostname: "LOCALHOST" } as Location);
  try {
    expect(isLocalTankArtilleryPromoHost()).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "127.0.0.1" } as Location);
  try {
    expect(isLocalTankArtilleryPromoHost()).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "example.com" } as Location);
  try {
    expect(isLocalTankArtilleryPromoHost()).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("promoSkipsGlobalSlotReserve: nur seba1/sebaxp/admins + Loopback", () => {
  vi.stubGlobal("location", { hostname: "localhost" } as Location);
  try {
    expect(promoSkipsGlobalSlotReserve("seba1")).toBe(true);
    expect(promoSkipsGlobalSlotReserve("sebaxp")).toBe(true);
    expect(promoSkipsGlobalSlotReserve("admins")).toBe(true);
    expect(promoSkipsGlobalSlotReserve("admin1")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "evil.test" } as Location);
  try {
    expect(promoSkipsGlobalSlotReserve("seba1")).toBe(false);
    expect(promoSkipsGlobalSlotReserve("sebaxp")).toBe(false);
    expect(promoSkipsGlobalSlotReserve("admins")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("adminGems nach gesetztem Flag: praktisch unbegrenzt", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.setItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY, "1");
  } catch {
    return;
  }
  try {
    expect(readGems()).toBe(Number.MAX_SAFE_INTEGER);
    expect(spendGems(2_000_000_000)).toBe(true);
    expect(readGems()).toBe(Number.MAX_SAFE_INTEGER);
  } finally {
    try {
      localStorage.removeItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY);
    } catch {
      /** ignore */
    }
  }
});

test("unlockAdminGems mit VITE_ADMIN_GEM_PASSPHRASE", () => {
  vi.stubEnv("VITE_ADMIN_GEM_PASSPHRASE", "host_only");
  try {
    try {
      localStorage.removeItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY);
    } catch {
      vi.unstubAllEnvs();
      return;
    }
    expect(unlockAdminGems("falsch")).toBe(false);
    expect(adminGemsUnlocked()).toBe(false);
    expect(unlockAdminGems("host_only")).toBe(true);
    expect(adminGemsUnlocked()).toBe(true);
  } finally {
    vi.unstubAllEnvs();
    try {
      localStorage.removeItem(ADMIN_GEMS_UNLOCK_STORAGE_KEY);
    } catch {
      /** ignore */
    }
  }
});

test("reservePromoGlobalSlot: ok vs full vs fehlernde Antwort", async () => {
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    expect(await reservePromoGlobalSlot("https://mock.example/claim")).toBe("ok");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, reason: "full" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    expect(await reservePromoGlobalSlot("https://mock.example/claim")).toBe("full");

    globalThis.fetch = (async () =>
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })) as typeof fetch;
    expect(await reservePromoGlobalSlot("https://mock.example/claim")).toBe("bad_response");

    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    expect(await reservePromoGlobalSlot("https://mock.example/claim")).toBe("network_error");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Silber-Panzer Munition schwächer als Feld-Green", () => {
  const a = getPlayerTankDef("silver")!;
  const b = getPlayerTankDef("green")!;
  expect(a.weapons[0]!.dmg).toBeLessThan(b.weapons[0]!.dmg);
  expect(a.priceGems).toBe(0);
  expect(b.priceGems).toBe(GEM_PRICE_TANK_GREEN);
  expect(GEM_PRICE_TANK_GREEN).toBe(100);
  expect(GEM_PRICE_TANK_NAVY).toBeGreaterThan(GEM_PRICE_TANK_GREEN);
  expect(GEM_PRICE_TANK_DESERT).toBeGreaterThan(GEM_PRICE_TANK_NAVY);
  expect(GEM_PRICE_TANK_CRIMSON).toBeGreaterThan(GEM_PRICE_TANK_DESERT);
  expect(GEM_PRICE_TANK_BUNKER).toBeGreaterThan(GEM_PRICE_TANK_CRIMSON);
  expect(GEM_PRICE_TANK_VIPER).toBeGreaterThan(GEM_PRICE_TANK_BUNKER);
  expect(getPlayerTankDef("navy")!.priceGems).toBe(GEM_PRICE_TANK_NAVY);
  expect(getPlayerTankDef("desert")!.priceGems).toBe(GEM_PRICE_TANK_DESERT);
  expect(getPlayerTankDef("crimson")!.priceGems).toBe(GEM_PRICE_TANK_CRIMSON);
  expect(getPlayerTankDef("bunker")!.priceGems).toBe(GEM_PRICE_TANK_BUNKER);
  expect(getPlayerTankDef("viper")!.priceGems).toBe(GEM_PRICE_TANK_VIPER);
  expect(getPlayerTankDef("crimson")!.customSprite).toBe("redStriker");
  expect(getPlayerTankDef("bunker")!.customSprite).toBe("bunkerShield");
  expect(getPlayerTankDef("viper")!.customSprite).toBe("viperEnergy");
});

test("Panzer maxHp steigt mit Stufe; Silber Basis", () => {
  expect(getPlayerTankDef("silver")!.maxHp).toBeLessThan(getPlayerTankDef("green")!.maxHp);
  expect(getPlayerTankDef("green")!.maxHp).toBeLessThan(getPlayerTankDef("navy")!.maxHp);
  expect(getPlayerTankDef("navy")!.maxHp).toBeLessThan(getPlayerTankDef("desert")!.maxHp);
  expect(getPlayerTankDef("desert")!.maxHp).toBeLessThan(getPlayerTankDef("crimson")!.maxHp);
  expect(getPlayerTankDef("crimson")!.maxHp).toBeLessThan(getPlayerTankDef("bunker")!.maxHp);
  expect(getPlayerTankDef("bunker")!.maxHp).toBeLessThan(getPlayerTankDef("viper")!.maxHp);
  expect(getPlayerTankDef("silver")!.maxHp).toBe(DEFAULT_HP);
});

test("Silber Einstreu: viele Kügelchen à 7 Schaden", () => {
  const e = getPlayerTankDef("silver")!.weapons[2]!;
  expect(e.nameDe).toBe("Einstreu");
  expect(e.dmg).toBe(7);
  expect(e.pelletBurst?.count).toBe(16);
  expect(e.pelletBurst?.spreadHalfDeg).toBe(7);
  const nd = getPlayerTankDef("green")!.weapons.find((w) => w.nameDe === "Nadelwald")!;
  expect(nd.pelletBurst).toEqual({ count: 10, spreadHalfDeg: 9 });
  expect(nd.dmg).toBe(8);
  const vip = getPlayerTankDef("viper")!.weapons.find((w) => w.nameDe === "Giftwolke")!;
  expect(vip.pelletBurst).toEqual({ count: 16, spreadHalfDeg: 10 });
  expect(vip.dmg).toBe(13);
  expect(VIPER_GIFT_BOMB_WEAPON.nameDe).toBe("Giftbombe");
  expect(VIPER_GIFT_BOMB_WEAPON.id).toBe("viper_gift_bomb");
  expect(lockerMaxBonusWeaponFor("viper")).toBe(VIPER_GIFT_BOMB_WEAPON);
  expect(lockerMaxBonusWeaponFor("silver").nameDe).toBe("Silbersterne");
  expect(lockerMaxBonusWeaponFor("green").nameDe).toBe("Waldkanone");
  expect(lockerMaxBonusWeaponFor("bunker").nameDe).toBe("Festungsbrecher");
});

test("Spezialattacke bei jedem Panzer, wenn Locker voll", () => {
  const max = {
    fuel: LOCKER_UPGRADE_MAX_LEVEL,
    damage: LOCKER_UPGRADE_MAX_LEVEL,
    power: LOCKER_UPGRADE_MAX_LEVEL,
  };
  expect(lockerMaxSpecialAttackUnlocked(max)).toBe(true);
  expect(lockerMaxSpecialAttackUnlocked({ ...max, fuel: 9 })).toBe(false);
  expect(lockerMaxSpecialAttackUnlocked({ fuel: 0, damage: 0, power: 0 })).toBe(false);
});

test("jitteredShotVelocity variiert gegenüber geradem Schuss", () => {
  let s = 99_001;
  const rnd = () => {
    s = ((s * 1103515245 + 12345) >>> 0) as number;
    return s / 4294967296;
  };
  const base = velocityFromElevDeg(true, 52, 600, 1.08);
  let different = false;
  for (let i = 0; i < 50; i++) {
    const v = jitteredShotVelocity(true, 52, 600, 1.08, 6, rnd);
    if (Math.abs(v.x - base.x) > 0.05 || Math.abs(v.y - base.y) > 0.05) different = true;
  }
  expect(different).toBe(true);
});

test("tryBuyTank und setEquippedTankId", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(TANK_STORAGE_OWNED);
    localStorage.removeItem(TANK_STORAGE_EQUIPPED);
    localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
  } catch {
    return;
  }
  expect(tryBuyTank("silver")).toBe("owned");
  addGems(150);
  expect(tryBuyTank("green")).toBe("ok");
  expect(readGems()).toBe(50);
  expect(readEquippedTankId()).toBe("green");
  expect(readOwnedTankIds().includes("green")).toBe(true);
  expect(tryBuyTank("green")).toBe("owned");
  expect(setEquippedTankId("silver")).toBe(true);
  expect(readEquippedTankId()).toBe("silver");
  expect(setEquippedTankId("navy")).toBe(false);
  addGems(GEM_PRICE_TANK_CRIMSON);
  expect(tryBuyTank("crimson")).toBe("ok");
  expect(readEquippedTankId()).toBe("crimson");
  expect(readOwnedTankIds().includes("crimson")).toBe(true);

  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(TANK_STORAGE_OWNED);
  localStorage.removeItem(TANK_STORAGE_EQUIPPED);
  localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
});

test("tryBuyDesertShield: missing_tank vs ok", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(TANK_STORAGE_OWNED);
    localStorage.removeItem(TANK_STORAGE_EQUIPPED);
    localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
  } catch {
    return;
  }
  addGems(DESERT_SHIELD_PRICE_GEMS + 100);
  expect(DESERT_SHIELD_ABSORB).toBe(80);
  expect(tryBuyDesertShield()).toBe("missing_tank");
  expect(readGems()).toBe(DESERT_SHIELD_PRICE_GEMS + 100);

  /** Volle Garage ohne Wüste reicht nicht */
  localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(["silver", "green", "navy"]));
  expect(tryBuyDesertShield()).toBe("missing_tank");

  /** Mit Wüste im Besitz */
  localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(["silver", "desert"]));
  expect(tryBuyDesertShield()).toBe("ok");
  expect(readGems()).toBe(100);
  expect(readDesertShieldCharges()).toBe(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE);
  expect(readDesertShieldOwned()).toBe(true);
  expect(tryBuyDesertShield()).toBe("owned");

  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(TANK_STORAGE_OWNED);
  localStorage.removeItem(TANK_STORAGE_EQUIPPED);
  localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
});

test("Kristallschild: drei Aktivierungen, dann wieder kaufen · Legacy „1“ = volles Paket", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(TANK_STORAGE_OWNED);
    localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
  } catch {
    return;
  }
  localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(["silver", "desert"]));

  localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, "1");
  expect(readDesertShieldCharges()).toBe(3);

  consumeDesertShieldActivation();
  expect(readDesertShieldCharges()).toBe(2);
  consumeDesertShieldActivation();
  consumeDesertShieldActivation();
  expect(readDesertShieldCharges()).toBe(0);
  expect(readDesertShieldOwned()).toBe(false);

  addGems(DESERT_SHIELD_PRICE_GEMS);
  expect(tryBuyDesertShield()).toBe("ok");
  expect(readGems()).toBe(0);
  expect(readDesertShieldCharges()).toBe(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE);

  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(TANK_STORAGE_OWNED);
  localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
});

test("readDesertShieldCharges: kaputte oder zu große Werte klemmen", () => {
  try {
    localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
  } catch {
    return;
  }
  localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, "nix");
  expect(readDesertShieldCharges()).toBe(0);
  localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, "99");
  expect(readDesertShieldCharges()).toBe(DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE);
  localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, "0");
  expect(readDesertShieldCharges()).toBe(0);
  localStorage.setItem(DESERT_SHIELD_STORAGE_KEY, "-2");
  expect(readDesertShieldCharges()).toBe(0);
});

test("tryBuyDesertShield: expensive ohne genug 💎", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(TANK_STORAGE_OWNED);
    localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
  } catch {
    return;
  }
  localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(["silver", "desert"]));
  addGems(DESERT_SHIELD_PRICE_GEMS - 1);
  expect(tryBuyDesertShield()).toBe("expensive");
  expect(readDesertShieldOwned()).toBe(false);
  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(TANK_STORAGE_OWNED);
  localStorage.removeItem(DESERT_SHIELD_STORAGE_KEY);
});

test("Fahr-Spur Kosmetik: kaufen, besitzen, ausrüsten", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(MOVE_TRAIL_OWNED_KEY);
    localStorage.removeItem(MOVE_TRAIL_EQUIPPED_KEY);
  } catch {
    return;
  }
  expect(readEquippedMoveTrail()).toBe("none");
  expect(readOwnedMoveTrailIds()).toEqual([]);
  addGems(MOVE_TRAIL_FIRE_PRICE_GEMS - 1);
  expect(tryBuyMoveTrailCosmetic("fire")).toBe("expensive");
  addGems(2);
  expect(tryBuyMoveTrailCosmetic("fire")).toBe("ok");
  expect(readOwnedMoveTrailIds()).toContain("fire");
  expect(readEquippedMoveTrail()).toBe("fire");
  expect(tryBuyMoveTrailCosmetic("fire")).toBe("owned");
  expect(setEquippedMoveTrail("none")).toBe(true);
  expect(readEquippedMoveTrail()).toBe("none");
  expect(setEquippedMoveTrail("fire")).toBe(true);
  expect(readEquippedMoveTrail()).toBe("fire");
  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(MOVE_TRAIL_OWNED_KEY);
  localStorage.removeItem(MOVE_TRAIL_EQUIPPED_KEY);
});

test("readEquippedMoveTrail: nicht besessene Auswahl → none", () => {
  try {
    localStorage.setItem(MOVE_TRAIL_OWNED_KEY, JSON.stringify(["fire"]));
    localStorage.setItem(MOVE_TRAIL_EQUIPPED_KEY, "lightning");
  } catch {
    return;
  }
  expect(readEquippedMoveTrail()).toBe("none");
  try {
    localStorage.setItem(MOVE_TRAIL_OWNED_KEY, JSON.stringify(["fire"]));
    localStorage.setItem(MOVE_TRAIL_EQUIPPED_KEY, "fire");
  } catch {
    return;
  }
  expect(readEquippedMoveTrail()).toBe("fire");
  localStorage.removeItem(MOVE_TRAIL_OWNED_KEY);
  localStorage.removeItem(MOVE_TRAIL_EQUIPPED_KEY);
});

test("Regenbogen-Spur: 2000 💎, Kauf und Ausrüsten", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(MOVE_TRAIL_OWNED_KEY);
    localStorage.removeItem(MOVE_TRAIL_EQUIPPED_KEY);
  } catch {
    return;
  }
  addGems(MOVE_TRAIL_RAINBOW_PRICE_GEMS - 1);
  expect(tryBuyMoveTrailCosmetic("rainbow")).toBe("expensive");
  addGems(1);
  expect(tryBuyMoveTrailCosmetic("rainbow")).toBe("ok");
  expect(readOwnedMoveTrailIds()).toContain("rainbow");
  expect(readEquippedMoveTrail()).toBe("rainbow");
  expect(tryBuyMoveTrailCosmetic("rainbow")).toBe("owned");
  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(MOVE_TRAIL_OWNED_KEY);
  localStorage.removeItem(MOVE_TRAIL_EQUIPPED_KEY);
});

test("Locker-Upgrades: Kosten steigen pro Stufe; Kauf & Maximum 10", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(LOCKER_UPGRADES_STORAGE_KEY);
  } catch {
    return;
  }
  const c0 = lockerUpgradeStepCostGems("fuel", 0);
  const c1 = lockerUpgradeStepCostGems("fuel", 1);
  expect(c1).toBeGreaterThan(c0);
  expect(lockerUpgradeStepCostGems("fuel", LOCKER_UPGRADE_MAX_LEVEL)).toBe(0);

  addGems(10_000);
  expect(tryBuyLockerUpgrade("fuel")).toBe("ok");
  expect(readLockerUpgradeLevelsFor("silver").fuel).toBe(1);
  expect(readLockerUpgradeLevelsFor("silver").damage).toBe(0);

  for (let i = readLockerUpgradeLevelsFor("silver").fuel; i < LOCKER_UPGRADE_MAX_LEVEL; i++) {
    expect(tryBuyLockerUpgrade("fuel")).toBe("ok");
  }
  expect(readLockerUpgradeLevelsFor("silver").fuel).toBe(LOCKER_UPGRADE_MAX_LEVEL);
  expect(tryBuyLockerUpgrade("fuel")).toBe("max");

  expect(lockerUpgradeFuelBonus(10)).toBe(180);
  expect(lockerUpgradeDamageMul(10)).toBeCloseTo(1 + 0.036 * 10, 5);
  expect(lockerUpgradePowMaxDelta(10)).toBe(160);

  try {
    localStorage.setItem(
      LOCKER_UPGRADES_STORAGE_KEY,
      JSON.stringify({ silver: { fuel: 99, damage: -3, power: "x" } }),
    );
  } catch {
    return;
  }
  const clamped = readLockerUpgradeLevelsFor("silver");
  expect(clamped.fuel).toBe(LOCKER_UPGRADE_MAX_LEVEL);
  expect(clamped.damage).toBe(0);
  expect(clamped.power).toBe(0);

  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(LOCKER_UPGRADES_STORAGE_KEY);
});

test("Locker: jeder Panzer eigene Stufen; früher flacher Save → alle 0", () => {
  try {
    localStorage.removeItem(GEM_STORAGE_KEY);
    localStorage.removeItem(LOCKER_UPGRADES_STORAGE_KEY);
    localStorage.setItem(TANK_STORAGE_OWNED, JSON.stringify(["silver", "green"]));
    localStorage.setItem(TANK_STORAGE_EQUIPPED, "silver");
  } catch {
    return;
  }
  addGems(50_000);
  expect(tryBuyLockerUpgrade("damage")).toBe("ok");
  expect(readLockerUpgradeLevelsFor("silver").damage).toBe(1);
  expect(readLockerUpgradeLevelsFor("green").damage).toBe(0);

  setEquippedTankId("green");
  expect(readLockerUpgradeLevels().damage).toBe(0);
  expect(tryBuyLockerUpgrade("damage")).toBe("ok");
  expect(readLockerUpgradeLevelsFor("green").damage).toBe(1);
  expect(readLockerUpgradeLevelsFor("silver").damage).toBe(1);

  localStorage.setItem(LOCKER_UPGRADES_STORAGE_KEY, JSON.stringify({ fuel: 5, damage: 5, power: 5 }));
  const m = readLockerUpgradeMap();
  expect(m.silver.fuel).toBe(0);
  expect(m.green.fuel).toBe(0);

  localStorage.removeItem(GEM_STORAGE_KEY);
  localStorage.removeItem(LOCKER_UPGRADES_STORAGE_KEY);
  localStorage.removeItem(TANK_STORAGE_OWNED);
  localStorage.removeItem(TANK_STORAGE_EQUIPPED);
});
