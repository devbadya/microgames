import { expect, test, vi } from "vitest";
import {
  addGems,
  applyCrater,
  BLITZ_DISPLAY_NAME_DE,
  buildTerrain,
  DEFAULT_HP,
  GEM_PRICE_TANK_DESERT,
  DESERT_SHIELD_PRICE_GEMS,
  DESERT_SHIELD_STORAGE_KEY,
  GEM_PRICE_TANK_GREEN,
  GEM_PRICE_TANK_NAVY,
  getPlayerTankDef,
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
  consumeDesertShieldActivation,
  DESERT_SHIELD_ACTIVATIONS_PER_PURCHASE,
  getWeapon,
  heightAt,
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
} from "./artillery-logic";

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
  expect(Math.abs(imp.y - localG)).toBeLessThan(3);
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
  const pts = sampleTrajectory(t, x0, y0, v.x, v.y, 3, 280, 1 / 140);
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

test("promoSkipsGlobalSlotReserve: nur seba1 + Loopback", () => {
  vi.stubGlobal("location", { hostname: "localhost" } as Location);
  try {
    expect(promoSkipsGlobalSlotReserve("seba1")).toBe(true);
    expect(promoSkipsGlobalSlotReserve("admin1")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("location", { hostname: "evil.test" } as Location);
  try {
    expect(promoSkipsGlobalSlotReserve("seba1")).toBe(false);
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
  expect(getPlayerTankDef("navy")!.priceGems).toBe(GEM_PRICE_TANK_NAVY);
  expect(getPlayerTankDef("desert")!.priceGems).toBe(GEM_PRICE_TANK_DESERT);
});

test("Panzer maxHp steigt mit Stufe; Silber Basis", () => {
  expect(getPlayerTankDef("silver")!.maxHp).toBeLessThan(getPlayerTankDef("green")!.maxHp);
  expect(getPlayerTankDef("green")!.maxHp).toBeLessThan(getPlayerTankDef("navy")!.maxHp);
  expect(getPlayerTankDef("navy")!.maxHp).toBeLessThan(getPlayerTankDef("desert")!.maxHp);
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
