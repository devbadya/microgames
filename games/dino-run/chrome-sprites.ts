/**
 * Arcade desert palette — colorful dusk sky + cool teal ground stripes.
 */

export const CHROME = {
  skyTop: "#0a101a",
  skyMid: "#132238",
  skyHorizonTint: "#1a3352",
  groundDeep: "#182235",
  groundStripeGlow: "rgba(110, 231, 255, 0.08)",
  groundLine: "rgba(110, 231, 255, 0.38)",
  pebbleInk: "#3d5f7d",
  pebbleGlow: "#6ee7ff",
  cloudSoft: "rgba(200, 220, 255, 0.18)",
  cloudCore: "rgba(110, 231, 255, 0.12)",
  moonGlow: "rgba(110, 231, 255, 0.1)",
  horizonDash: "rgba(110, 231, 255, 0.55)",
  cactusDark: "#2a9d5e",
  cactusMid: "#3cb878",
  cactusAccent: "#5ee9a8",
  birdBody: "#a78bfa",
  birdWing: "#ddd6fe",
  birdBeak: "#fbbf77",
  starBright: "rgba(255, 255, 255, 0.38)",
  scratchDiag: "rgba(110, 231, 255, 0.15)",
} as const;

/** Scrolling desert floor with diagonal grooves + tinted pebble marks */
export function drawChromeDesertFloor(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  CANVAS_H: number,
  GROUND_Y: number,
  scroll: number,
): void {
  g.fillStyle = CHROME.groundDeep;
  g.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  const t = scroll % 28;
  g.strokeStyle = CHROME.groundStripeGlow;
  g.lineWidth = 1;
  for (let x = -t; x < CANVAS_W + 28; x += 28) {
    g.beginPath();
    g.moveTo(x, GROUND_Y + 8);
    g.lineTo(x + 14, CANVAS_H);
    g.stroke();
  }
  g.fillStyle = "rgba(0, 0, 0, 0.2)";
  g.fillRect(0, GROUND_Y + 3, CANVAS_W, 4);

  const drift = scroll * 1.12;
  const layers = [
    { count: 90, ys: 0.12, spd: 1.05, ink: CHROME.pebbleGlow, alpha: 0.72 },
    { count: 55, ys: 0.35, spd: 0.92, ink: CHROME.pebbleInk, alpha: 0.65 },
    { count: 35, ys: 0.58, spd: 0.78, ink: "#4a7089", alpha: 0.45 },
  ] as const;

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const h = CANVAS_H - GROUND_Y;
      const z = i * 977 + layer.count;
      let x =
        (((z * 793) >>> 5) % (CANVAS_W + 80)) - drift * layer.spd + Math.sin(z * 0.01 + layer.ys * 13) * 3;
      x = ((x % (CANVAS_W + 120)) + (CANVAS_W + 120)) % (CANVAS_W + 120) - 20;
      const y = GROUND_Y + 12 + ((((z >>> 5) % 1000) / 1000) * (h - 24) * (0.3 + layer.ys));
      const pw = (((z >>> 9) % 3) === 0 ? 2 : 1);
      const ph = (((z >>> 11) % 4) === 0 ? 2 : 1);
      if (x > -8 && x < CANVAS_W + 8 && y < CANVAS_H - 4) {
        g.globalAlpha = layer.alpha;
        g.fillStyle = layer.ink;
        g.fillRect(Math.round(x), Math.round(y), pw, ph);
      }
    }
    g.globalAlpha = 1;
  }

  g.globalAlpha = 0.42;
  g.strokeStyle = CHROME.scratchDiag;
  g.lineWidth = 1;
  const zig = scroll * 0.72;
  for (let sx = -50; sx < CANVAS_W + 70; sx += 18) {
    const gx = Math.floor((sx + zig * 31) % 36);
    const bx = sx + gx * 0.12;
    const by = GROUND_Y + 22 + (sx % 7) + ((sx * 97) % 11);
    g.beginPath();
    g.moveTo(bx, by + 14);
    g.lineTo(bx + 14, by);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function drawChromeBird(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  runTime: number,
  birdId: number,
): void {
  const wing = (Math.floor(runTime * 11 + birdId * 1.873) % 2) as 0 | 1;
  drawChromeBirdFrame(g, b, wing);
}

function drawChromeBirdFrame(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  wing: 0 | 1,
): void {
  const cx = b.x + b.w * 0.42;
  const cy = b.y + b.h * 0.48;

  g.fillStyle = CHROME.birdBody;
  g.fillRect(b.x + b.w * 0.32, b.y + b.h * 0.38, b.w * 0.55, b.h * 0.38);
  g.fillStyle = CHROME.birdWing;

  if (wing === 0) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.02, b.y + b.h * 0.95);
    g.lineTo(b.x + b.w * 0.28, b.y + b.h * 0.58);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.98, b.y + b.h * 0.88);
    g.lineTo(b.x + b.w * 0.72, b.y + b.h * 0.55);
    g.closePath();
    g.fill();
  } else {
    g.fillStyle = CHROME.birdBody;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.05, b.y + b.h * 0.18);
    g.lineTo(b.x + b.w * 0.3, b.y + b.h * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = CHROME.birdWing;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(b.x + b.w * 0.96, b.y + b.h * 0.2);
    g.lineTo(b.x + b.w * 0.68, b.y + b.h * 0.45);
    g.closePath();
    g.fill();
  }

  g.fillStyle = CHROME.birdBeak;
  g.fillRect(b.x + b.w * 0.78, b.y + b.h * 0.42, Math.max(3, b.w * 0.14), b.h * 0.14);
}

export function drawChromeCactus(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
): void {
  const stemW = Math.max(4, b.w * 0.22);
  const cx = b.x + b.w * 0.5 - stemW * 0.5;
  g.fillStyle = CHROME.cactusDark;
  g.fillRect(cx, b.y, stemW, b.h);
  g.fillStyle = CHROME.cactusAccent;
  g.fillRect(cx + 2, Math.max(b.y + 3, b.y + b.h * 0.1), stemW - 4, Math.max(2, stemW * 0.28));
  g.fillStyle = CHROME.cactusMid;
  if (b.w > 18) {
    const armH = Math.min(b.h * 0.32, 18);
    const armW = Math.max(5, b.w * 0.28);
    g.fillRect(b.x + b.w * 0.08, b.y + b.h * 0.38, armW, armH);
    g.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.32, armW, armH);
    g.fillStyle = CHROME.cactusAccent;
    g.fillRect(b.x + b.w * 0.1 + 1, b.y + b.h * 0.42, armW - 2, armH * 0.35);
    g.fillRect(b.x + b.w * 0.64 + 1, b.y + b.h * 0.36, armW - 2, armH * 0.35);
  }
}

export function drawChromeCloud(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = CHROME.cloudCore;
  g.fillRect(x, y + h * 0.35, w, h * 0.35);
  g.fillStyle = CHROME.cloudSoft;
  g.fillRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.45);
  g.fillRect(x + w * 0.35, y, w * 0.45, h * 0.45);
  const u = Math.max(2, w * 0.25);
  g.fillStyle = CHROME.cloudCore;
  g.fillRect(x + w * 0.55, y + h * 0.12, u, h * 0.35);
}

export function drawChromeHorizon(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const dash = 13;
  const gap = 11;
  const cycle = dash + gap;
  const off = -((scroll * 0.88) % cycle);
  g.fillStyle = CHROME.horizonDash;
  for (let x = off; x < CANVAS_W + cycle; x += cycle) {
    g.fillRect(x, GROUND_Y - 1, dash, 2);
  }

  g.fillStyle = CHROME.groundLine;
  g.fillRect(0, GROUND_Y, CANVAS_W, 1.25);
}

/** Night-sky vignette blobs + drifting clouds */
export function drawChromeSkyBackdrop(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const grd = g.createLinearGradient(0, 0, 0, GROUND_Y);
  grd.addColorStop(0, CHROME.skyTop);
  grd.addColorStop(0.52, CHROME.skyMid);
  grd.addColorStop(1, CHROME.skyHorizonTint);
  g.fillStyle = grd;
  g.fillRect(0, 0, CANVAS_W, GROUND_Y);

  const stars = [21, 67, 103, 189, 256, 312, 400, 470, 520, 601, 702, 755];
  g.fillStyle = CHROME.starBright;
  for (const sx of stars) {
    const x = (sx + scroll * 0.04) % (CANVAS_W + 8);
    g.fillRect(x, 32 + (sx % 97) * 0.13, 2, 2);
  }

  g.fillStyle = CHROME.cloudSoft;
  g.beginPath();
  g.ellipse(120 + (scroll * 0.15) % 200, 56, 52, 18, 0, 0, Math.PI * 2);
  g.ellipse(380 + (scroll * 0.1) % 180, 48, 44, 14, 0, 0, Math.PI * 2);
  g.ellipse(580 + (scroll * 0.12) % 160, 62, 38, 12, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = CHROME.moonGlow;
  g.beginPath();
  g.arc(CANVAS_W * 0.88, 52, 40, 0, Math.PI * 2);
  g.fill();

  const seeds = [
    [40, 28, 84, 22],
    [220, 44, 72, 18],
    [420, 32, 90, 26],
    [640, 48, 68, 20],
  ] as const;
  for (let i = 0; i < seeds.length; i++) {
    const [bx, by, bw, bh] = seeds[i];
    const sx = ((bx + scroll * (0.05 + i * 0.02)) % (CANVAS_W + bw + 40)) - 20;
    drawChromeCloud(g, sx, by, bw, bh);
  }
}
