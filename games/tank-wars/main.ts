import "./style.css";

import type { Loadout, Wall } from "./tank-logic";
import {
  ARENA,
  LOADOUTS,
  TANK_BODY_R,
  addStoredXp,
  circleHitsWall,
  clampToArena,
  distSq,
  levelFromXp,
  readStoredXp,
  spreadAngles,
  XP_PER_WIN,
} from "./tank-logic";

const TW_ASSET_ROOT = `${import.meta.env.BASE_URL}games/tank-wars/kenney`;

interface TankEntity {
  x: number;
  y: number;
  angle: number;
  hp: number;
  cooldown: number;
  loadout: Loadout;
}

interface BulletEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  pierceLeft: number;
  ownerIsPlayer: boolean;
  imgName: string;
}

interface WallDraw extends Wall {
  img: HTMLImageElement | null;
}

interface Smoke {
  x: number;
  y: number;
  frame: number;
  ttl: number;
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let images: Map<string, HTMLImageElement> = new Map();
let walls: WallDraw[] = [];
let player: TankEntity | null = null;
let bot: TankEntity | null = null;
let bullets: BulletEntity[] = [];
let smokes: Smoke[] = [];
let keys = new Set<string>();
let lastTs = 0;
let animationId = 0;
let outcome: "playing" | "win" | "lose" = "playing";
let xpEl: HTMLElement | null = null;
let levelEl: HTMLElement | null = null;

function imgUrl(relativePNG: string): string {
  return `${TW_ASSET_ROOT}/${relativePNG}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(src));
    im.src = src;
  });
}

async function preloadAll(): Promise<void> {
  const paths = [
    "PNG/Tanks/tankGreen.png",
    "PNG/Tanks/tankBlue.png",
    "PNG/Tanks/tankRed.png",
    "PNG/Tanks/tankBeige.png",
    "PNG/Tanks/tankBlack.png",
    "PNG/Bullets/bulletGreen.png",
    "PNG/Bullets/bulletBlue.png",
    "PNG/Bullets/bulletRed.png",
    "PNG/Bullets/bulletYellow.png",
    "PNG/Bullets/bulletSilver.png",
    "PNG/Environment/sand.png",
    "PNG/Environment/grass.png",
    "PNG/Obstacles/sandbagBeige.png",
    "PNG/Obstacles/sandbagBrown.png",
    "PNG/Smoke/smokeOrange0.png",
    "PNG/Smoke/smokeOrange1.png",
    "PNG/Smoke/smokeOrange2.png",
  ];
  await Promise.all(
    paths.map(async (p) => {
      images.set(p, await loadImage(imgUrl(p)));
    }),
  );
}

function makeWalls(): void {
  const sandA = images.get("PNG/Obstacles/sandbagBeige.png")!;
  const sandB = images.get("PNG/Obstacles/sandbagBrown.png")!;
  const iw = Math.min(88, sandA?.naturalWidth || 72);
  const ih = Math.min(50, sandA?.naturalHeight || 40);
  walls = [
    { x: 380, y: 150, w: iw, h: ih, img: sandA ?? null },
    { x: 520, y: 150, w: iw, h: ih, img: sandB ?? null },
    { x: 320, y: 300, w: iw, h: ih, img: sandB ?? null },
    { x: 580, y: 300, w: iw, h: ih, img: sandA ?? null },
    { x: 450, y: 400, w: iw, h: ih, img: sandA ?? null },
  ];
}

/** Sprite faces “up”; game angle uses standard math (0 = east). */
const SPRITE_EXTRA = Math.PI / 2;

function drawTank(ent: TankEntity): void {
  const path = `PNG/Tanks/${ent.loadout.tankFile}`;
  const im = images.get(path);
  if (!im) return;
  const pw = Math.min(56, (im.naturalWidth || im.width) * 0.9);
  const ph = pw * ((im.naturalHeight || im.height) / (im.naturalWidth || im.width || 1));
  ctx.save();
  ctx.translate(ent.x, ent.y);
  ctx.rotate(ent.angle + SPRITE_EXTRA);
  ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph);
  ctx.restore();
}

function drawBullet(b: BulletEntity): void {
  const path = `PNG/Bullets/${b.imgName}`;
  const im = images.get(path);
  if (!im) return;
  const w = Math.max(b.radius * 4, (im.naturalWidth || 16) * 0.85);
  const h = w * ((im.naturalHeight || im.height) / (im.naturalWidth || im.width || 1));
  const ang = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang + SPRITE_EXTRA);
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawScene(): void {
  const grass = images.get("PNG/Environment/grass.png");
  ctx.clearRect(0, 0, ARENA.W, ARENA.H);
  ctx.fillStyle = "#c2a06a";
  ctx.fillRect(0, 0, ARENA.W, ARENA.H);
  if (grass?.complete && (grass.naturalWidth || grass.width)) {
    const iw = grass.naturalWidth || grass.width || 96;
    const ih = grass.naturalHeight || grass.height || 96;
    for (let y = 0; y < ARENA.H; y += ih) {
      for (let x = 0; x < ARENA.W; x += iw) {
        ctx.drawImage(grass, x, y);
      }
    }
  }

  for (const w of walls as Wall[]) {
    const wd = w as WallDraw;
    let { x, y, w: ww, h: hh } = w;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 4, y + 6, ww, hh);
    if (wd.img?.complete) {
      ctx.drawImage(wd.img, x, y, ww, hh);
    } else {
      ctx.fillStyle = "#795548";
      ctx.fillRect(x, y, ww, hh);
    }
  }

  if (bot) drawTank(bot);
  if (player) drawTank(player);
  for (const b of bullets) drawBullet(b);

  for (const s of smokes) {
    const k = ["PNG/Smoke/smokeOrange0.png", "PNG/Smoke/smokeOrange1.png", "PNG/Smoke/smokeOrange2.png"][
      s.frame % 3
    ]!;
    const im = images.get(k);
    if (im?.complete) {
      ctx.globalAlpha = 0.85;
      const sc = 1.8 - s.frame * 0.2;
      const sz = 88 * Math.max(sc, 0.4);
      ctx.drawImage(im, s.x - sz / 2, s.y - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    }
  }

  /** HP bars */
  const bar = (x: number, y: number, label: string, hp: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, 120, 10);
    ctx.fillStyle = hp > 30 ? "#4ade80" : "#f97316";
    ctx.fillRect(x, y, (120 * hp) / 100, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, x, y - 4);
  };
  if (player) bar(14, 10, `${player.loadout.name}`, player.hp);
  if (bot) bar(ARENA.W - 134, 10, `${bot.loadout.name} (Bot)`, bot.hp);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "#3f3f46";
  ctx.strokeRect(0, 0, ARENA.W, ARENA.H);
}

function shortestAngleToward(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pushTankOutOfWall(t: TankEntity, w: Wall): void {
  const cx = Math.max(w.x, Math.min(t.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(t.y, w.y + w.h));
  const dx = t.x - cx;
  const dy = t.y - cy;
  const dl = Math.hypot(dx, dy) || 1;
  const overlap = TANK_BODY_R - dl + 2;
  if (overlap > 0) {
    t.x += (dx / dl) * overlap;
    t.y += (dy / dl) * overlap;
  }
}

function resolveTankTank(a: TankEntity, b: TankEntity): void {
  const d2 = distSq(a.x, a.y, b.x, b.y);
  const minR = TANK_BODY_R * 2;
  if (d2 >= minR * minR) return;
  const d = Math.sqrt(Math.max(d2, 1e-6));
  const ux = (a.x - b.x) / d;
  const uy = (a.y - b.y) / d;
  const push = ((minR - d) / 2) * 0.92;
  a.x += ux * push;
  a.y += uy * push;
  b.x -= ux * push;
  b.y -= uy * push;
}

function wallList(): Wall[] {
  return walls.map(({ x, y, w, h }) => ({ x, y, w, h }));
}

function tryMoveTank(ent: TankEntity, dx: number, dy: number): void {
  ent.x += dx;
  ent.y += dy;
  const wl = wallList();
  for (const w of wl) pushTankOutOfWall(ent, w);
  const [cx, cy] = clampToArena(ent.x, ent.y, TANK_BODY_R);
  ent.x = cx;
  ent.y = cy;
}

function spawnBullets(ent: TankEntity, ownerIsPlayer: boolean): void {
  const f = ent.loadout.fire;
  const angles = spreadAngles(ent.angle, f.count, f.spread);
  for (const ang of angles) {
    const x = ent.x + Math.cos(ang) * 34;
    const y = ent.y + Math.sin(ang) * 34;
    bullets.push({
      x,
      y,
      vx: Math.cos(ang) * f.speed,
      vy: Math.sin(ang) * f.speed,
      damage: f.damage,
      radius: f.radius,
      pierceLeft: f.pierce,
      ownerIsPlayer,
      imgName: ent.loadout.bulletFile,
    });
  }
}

function nudgeBulletOutOfWall(b: BulletEntity, w: Wall): void {
  const cx = Math.max(w.x, Math.min(b.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
  let dx = b.x - cx;
  let dy = b.y - cy;
  const hl = Math.hypot(dx, dy) || 1;
  dx /= hl;
  dy /= hl;
  b.x = cx + dx * (b.radius + 4);
  b.y = cy + dy * (b.radius + 4);
}

function step(dt: number): void {
  if (outcome !== "playing" || !player || !bot) return;

  const spd = 128;
  const rot = 2.85;
  const turnL = keys.has("KeyA") || keys.has("ArrowLeft");
  const turnR = keys.has("KeyD") || keys.has("ArrowRight");
  const fwd = keys.has("KeyW") || keys.has("ArrowUp");
  const back = keys.has("KeyS") || keys.has("ArrowDown");

  if (turnL) player.angle -= rot * dt;
  if (turnR) player.angle += rot * dt;

  let mdx = 0;
  let mdy = 0;
  if (fwd) {
    mdx += Math.cos(player.angle) * spd * dt;
    mdy += Math.sin(player.angle) * spd * dt;
  }
  if (back) {
    mdx -= Math.cos(player.angle) * spd * 0.55 * dt;
    mdy -= Math.sin(player.angle) * spd * 0.55 * dt;
  }
  tryMoveTank(player, mdx, mdy);

  /** Bot */
  const tx = bot.x - player.x;
  const ty = bot.y - player.y;
  const dist = Math.hypot(tx, ty);
  const want = Math.atan2(ty, tx);
  const diff = shortestAngleToward(bot.angle, want);
  bot.angle += Math.sign(diff) * Math.min(Math.abs(diff), rot * dt * (1 + (dist > 180 ? 0.4 : 0)));

  if (dist > 110) {
    tryMoveTank(bot, Math.cos(bot.angle) * spd * dt * 0.85, Math.sin(bot.angle) * spd * dt * 0.85);
  } else if (dist < 80) {
    tryMoveTank(bot, -Math.cos(bot.angle) * spd * dt * 0.45, -Math.sin(bot.angle) * spd * dt * 0.45);
  }

  if (player.cooldown > 0) player.cooldown -= dt * 1000;
  if (bot.cooldown > 0) bot.cooldown -= dt * 1000;

  resolveTankTank(player, bot);

  /** Fire bot */
  if (bot.cooldown <= 0 && dist > 46 && Math.abs(shortestAngleToward(bot.angle, want)) < 0.4 && Math.random() < 0.022) {
    spawnBullets(bot, false);
    bot.cooldown = bot.loadout.fire.cooldownMs;
  }

  /** Bullets */
  const wl = wallList();
  const nextBullets: BulletEntity[] = [];
  for (const b of bullets) {
    if (Math.abs(b.x) > ARENA.W * 4 || Math.abs(b.y) > ARENA.H * 4) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    const hitWall = circleHitsWall(b.x, b.y, b.radius, wl);
    if (hitWall) {
      if (b.pierceLeft > 0) {
        b.pierceLeft--;
        nudgeBulletOutOfWall(b, hitWall);
        nextBullets.push(b);
      }
      continue;
    }

    const rHit = TANK_BODY_R + b.radius;
    const r2 = rHit * rHit;
    if (b.ownerIsPlayer) {
      if (distSq(b.x, b.y, bot.x, bot.y) < r2) {
        bot.hp -= b.damage;
        smokes.push({ x: bot.x, y: bot.y, frame: 0, ttl: 400 });
        continue;
      }
    } else if (distSq(b.x, b.y, player.x, player.y) < r2) {
      player.hp -= b.damage;
      smokes.push({ x: player.x, y: player.y, frame: 0, ttl: 400 });
      continue;
    }
    nextBullets.push(b);
  }
  bullets = nextBullets;

  if (player.hp <= 0) {
    player.hp = 0;
    outcome = "lose";
    showOutcome(false);
    return;
  }
  if (bot.hp <= 0) {
    bot.hp = 0;
    outcome = "win";
    showOutcome(true);
  }
}

function showOutcome(win: boolean): void {
  const overlay = document.getElementById("twOverlay");
  const title = document.getElementById("twOutcomeTitle");
  const sub = document.getElementById("twOutcomeSub");
  const btn = document.getElementById("twAgainBtn");
  if (!overlay || !title || !sub) return;

  if (win) {
    const nx = addStoredXp(XP_PER_WIN);
    title.textContent = "Sieg!";
    sub.textContent = `+${XP_PER_WIN} XP · Gesamt ${nx}`;
    refreshXpHud();
    const tw = window as Window & { __twWin?: boolean };
    tw.__twWin = true;
  } else {
    title.textContent = "Niederlage!";
    sub.textContent = "Nochmal probieren.";
  }
  overlay.hidden = false;
  btn?.focus();
}

function refreshXpHud(): void {
  const xp = readStoredXp();
  if (xpEl) xpEl.textContent = String(xp);
  if (levelEl) levelEl.textContent = String(levelFromXp(xp));
}

function tick(now: number): void {
  if (!lastTs) lastTs = now;
  let dt = (now - lastTs) / 1000;
  lastTs = now;
  dt = Math.min(0.05, dt);
  step(dt);
  smokes = smokes
    .map((s) => ({ ...s, frame: s.frame + 1, ttl: s.ttl - dt * 1000 }))
    .filter((s) => s.ttl > 0);
  drawScene();
  animationId = requestAnimationFrame(tick);
}

function startBattle(loadoutId: string): void {
  const pl = LOADOUTS.find((x) => x.id === loadoutId) ?? LOADOUTS[0]!;
  outcome = "playing";
  bullets = [];
  smokes = [];

  player = { x: 160, y: ARENA.H / 2, angle: 0, hp: 100, cooldown: 0, loadout: pl };

  const idx = LOADOUTS.indexOf(pl);
  let botLd = LOADOUTS[(idx + 2) % LOADOUTS.length]!;
  if (botLd.id === pl.id) botLd = LOADOUTS[(idx + 1) % LOADOUTS.length]!;
  bot = {
    x: ARENA.W - 160,
    y: ARENA.H / 2,
    angle: Math.PI,
    hp: 100,
    cooldown: 0,
    loadout: botLd,
  };

  document.getElementById("twSelectOverlay")!.hidden = true;

  lastTs = 0;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(tick);
  canvas.focus();

  const tw = window as Window & { __twWin?: boolean };
  tw.__twWin = undefined;
}

function resetToSelect(): void {
  outcome = "playing";
  player = null;
  bot = null;
  bullets = [];
  cancelAnimationFrame(animationId);
  const overlay = document.getElementById("twOverlay");
  if (overlay) overlay.hidden = true;
  const sel = document.getElementById("twSelectOverlay");
  if (sel) sel.hidden = false;
  drawScene();
}

document.addEventListener("DOMContentLoaded", async () => {
  canvas = document.getElementById("arena") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;
  xpEl = document.getElementById("twXpTotal");
  levelEl = document.getElementById("twLevel");
  refreshXpHud();

  try {
    await preloadAll();
  } catch (e) {
    console.warn("Tank sprites preload failed:", e);
  }
  makeWalls();
  canvas.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space") {
      e.preventDefault();
      if (document.getElementById("twSelectOverlay")?.hidden === false) return;
      if (document.getElementById("twOverlay")?.hidden === false) return;
      if (player && player.cooldown <= 0) {
        spawnBullets(player, true);
        player.cooldown = player.loadout.fire.cooldownMs;
      }
    }
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.code));

  document.querySelectorAll<HTMLButtonElement>(".twPick").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.loadout ?? "striker";
      startBattle(id);
    }),
  );

  document.getElementById("twAgainBtn")?.addEventListener("click", () => {
    resetToSelect();
  });

  document.getElementById("twSelectOverlay")!.hidden = false;

  const w = window as Window & { __twReady?: boolean };
  w.__twReady = true;
  drawScene();
});
