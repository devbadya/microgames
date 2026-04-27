import {
  createDinoState,
  startRun,
  tickDino,
  playerBox,
  obstacleBox,
  DESIGN,
  type DinoState,
} from "./dino-logic";

const LS_KEY = "microgames.dinoRun.best";

function getStoredBest(): number {
  const raw = window.localStorage.getItem(LS_KEY);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function storeBest(v: number): void {
  window.localStorage.setItem(LS_KEY, String(v));
}

const canvas = document.getElementById("app") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLElement;
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");

if (!canvas || !stage) {
  throw new Error("Dino: missing canvas or stage");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Dino: 2D context not available");

let state: DinoState = createDinoState(getStoredBest());
let jumpQueued = false;
const keys = { ArrowDown: false };

const rng = (): number => Math.random();

function setHud(): void {
  if (bestEl) bestEl.textContent = String(state.best);
  if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
}

function showOverlay(msg: string): void {
  if (overlayMsg) overlayMsg.textContent = msg;
  if (overlayEl) overlayEl.hidden = false;
}

function hideOverlay(): void {
  if (overlayEl) overlayEl.hidden = true;
}

function handleStartOrRestart(): void {
  if (state.phase === "idle" || state.phase === "dead") {
    state = startRun(state);
    setHud();
    hideOverlay();
  }
}

function onPointerPrimary(): void {
  if (state.phase === "running") {
    jumpQueued = true;
  } else {
    handleStartOrRestart();
  }
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    if (state.phase === "running") {
      jumpQueued = true;
    } else {
      handleStartOrRestart();
    }
  }
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    keys.ArrowDown = true;
  }
  if (e.key === "Enter" && (state.phase === "idle" || state.phase === "dead")) {
    e.preventDefault();
    handleStartOrRestart();
  }
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    keys.ArrowDown = false;
  }
});

stage.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  onPointerPrimary();
});

const touchJump = document.getElementById("touchJump");
if (touchJump) {
  touchJump.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state.phase === "running") {
      jumpQueued = true;
    } else {
      handleStartOrRestart();
    }
  });
}

const touchDuck = document.getElementById("touchDuck");
if (touchDuck) {
  touchDuck.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys.ArrowDown = true;
  });
  const endDuck = (): void => {
    keys.ArrowDown = false;
  };
  touchDuck.addEventListener("pointerup", endDuck);
  touchDuck.addEventListener("pointercancel", endDuck);
  touchDuck.addEventListener("pointerleave", endDuck);
}

const palette = {
  bgTop: "#0a101a",
  bgBottom: "#0d1524",
  ground: "#182235",
  groundLine: "rgba(110, 231, 255, 0.18)",
  cactus: "#3cb878",
  cactus2: "#2a9d5e",
  bird: "rgba(200, 160, 255, 0.9)",
  dino: "#e8c96a",
  dinoDark: "#b89440",
  dinoBeak: "#f0a868",
  cloud: "rgba(255,255,255,0.04)",
};

let lastT = 0;

function syncCanvasLayout(): void {
  const c = ctx;
  if (!c) return;
  const rw = canvas.width;
  const rh = canvas.height;
  const scale = Math.min(rw / DESIGN.CANVAS_W, rh / DESIGN.CANVAS_H);
  const ox = (rw - DESIGN.CANVAS_W * scale) / 2;
  const oy = (rh - DESIGN.CANVAS_H * scale) / 2;
  c.setTransform(scale, 0, 0, scale, ox, oy);
  c.imageSmoothingEnabled = false;
}

function drawParallax(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  CANVAS_H: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const stars = [21, 67, 103, 189, 256, 312, 400, 470, 520, 601, 702, 755];
  g.fillStyle = "rgba(255, 255, 255, 0.22)";
  for (const x of stars) {
    const sx = (x + scroll * 0.04) % (CANVAS_W + 8);
    g.fillRect(sx, 32 + (x % 97) * 0.13, 2, 2);
  }
  g.fillStyle = "rgba(200, 220, 255, 0.16)";
  g.beginPath();
  g.ellipse(120 + (scroll * 0.15) % 200, 56, 52, 18, 0, 0, Math.PI * 2);
  g.ellipse(380 + (scroll * 0.1) % 180, 48, 44, 14, 0, 0, Math.PI * 2);
  g.ellipse(580 + (scroll * 0.12) % 160, 62, 38, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(110, 231, 255, 0.1)";
  g.beginPath();
  g.arc(CANVAS_W * 0.88, 52, 40, 0, Math.PI * 2);
  g.fill();
}

function drawGroundStripes(
  g: CanvasRenderingContext2D,
  CANVAS_W: number,
  CANVAS_H: number,
  GROUND_Y: number,
  scroll: number,
): void {
  const t = scroll % 28;
  g.strokeStyle = "rgba(255, 255, 255, 0.04)";
  g.lineWidth = 1;
  for (let x = -t; x < CANVAS_W + 28; x += 28) {
    g.beginPath();
    g.moveTo(x, GROUND_Y + 8);
    g.lineTo(x + 14, CANVAS_H);
    g.stroke();
  }
  g.fillStyle = "rgba(0, 0, 0, 0.2)";
  g.fillRect(0, GROUND_Y + 3, CANVAS_W, 4);
}

function drawCactus(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  dark: string,
  light: string,
): void {
  g.fillStyle = dark;
  g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = light;
  g.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h * 0.32);
  const armH = Math.min(14, b.h * 0.35);
  const armW = Math.max(4, b.w * 0.4);
  g.fillStyle = dark;
  g.fillRect(b.x - armW * 0.2, b.y + b.h * 0.35, armW, armH);
  g.fillRect(b.x + b.w - armW * 0.8, b.y + b.h * 0.4, armW, armH);
  g.fillStyle = light;
  g.fillRect(b.x - 1, b.y + b.h * 0.32, 5, 5);
  g.fillRect(b.x + b.w - 4, b.y + b.h * 0.36, 5, 5);
}

function drawBird(
  g: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  fill: string,
  stroke: string,
): void {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(b.x, b.y + b.h);
  g.lineTo(b.x + b.w * 0.5, b.y);
  g.lineTo(b.x + b.w, b.y + b.h);
  g.closePath();
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(b.x + 4, b.y + b.h * 0.6);
  g.lineTo(b.x + b.w * 0.5, b.y + 6);
  g.stroke();
  g.fillStyle = "rgba(255, 200, 120, 0.95)";
  g.beginPath();
  g.moveTo(b.x + b.w, b.y + b.h * 0.7);
  g.lineTo(b.x + b.w + 5, b.y + b.h * 0.65);
  g.lineTo(b.x + b.w, b.y + b.h);
  g.closePath();
  g.fill();
}

function drawDino(
  g: CanvasRenderingContext2D,
  pb: { x: number; y: number; w: number; h: number },
  duck: boolean,
  dark: string,
  light: string,
  accent: string,
  t: number,
): void {
  g.fillStyle = dark;
  g.fillRect(pb.x, pb.y, pb.w, pb.h);
  g.fillStyle = light;
  g.fillRect(pb.x + 3, pb.y + 4, Math.max(1, pb.w - 6), Math.max(1, pb.h - 10));
  if (!duck) {
    g.fillStyle = dark;
    g.fillRect(pb.x - 3, pb.y + Math.sin(t * 0.04) * 1.5 + pb.h * 0.55, 6, 4);
  }
  g.fillStyle = accent;
  g.fillRect(pb.x + pb.w * 0.6, pb.y + 3, 10, 6);
  g.fillStyle = "#1a1a24";
  g.fillRect(pb.x + pb.w * 0.62, pb.y + 4, 3, 3);
  if (!duck) {
    g.fillStyle = light;
    g.fillRect(pb.x - 1, pb.y + 8, 4, 3);
  }
}

function draw(s: DinoState): void {
  const g = ctx;
  if (!g) return;
  const { CANVAS_W, CANVAS_H, GROUND_Y } = DESIGN;
  const scroll = s.runTime * s.speed * 0.11;

  const grd = g.createLinearGradient(0, 0, 0, CANVAS_H);
  grd.addColorStop(0, palette.bgTop);
  grd.addColorStop(0.55, "#0a1422");
  grd.addColorStop(1, palette.bgBottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawParallax(g, CANVAS_W, CANVAS_H, GROUND_Y, scroll);

  const skyVignette = g.createRadialGradient(
    CANVAS_W * 0.48,
    GROUND_Y * 0.42,
    20,
    CANVAS_W * 0.5,
    GROUND_Y * 0.55,
    420,
  );
  skyVignette.addColorStop(0, "rgba(0,0,0,0)");
  skyVignette.addColorStop(1, "rgba(0,0,0,0.2)");
  g.fillStyle = skyVignette;
  g.fillRect(0, 0, CANVAS_W, GROUND_Y);

  g.fillStyle = palette.ground;
  g.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
  drawGroundStripes(g, CANVAS_W, CANVAS_H, GROUND_Y, scroll);
  g.fillStyle = palette.groundLine;
  g.fillRect(0, GROUND_Y, CANVAS_W, 1.5);

  for (const o of s.obstacles) {
    const b = obstacleBox(o, GROUND_Y);
    if (o.kind === "cactus") {
      drawCactus(g, b, palette.cactus2, palette.cactus);
    } else {
      drawBird(g, b, palette.bird, "rgba(220, 180, 255, 0.5)");
    }
  }

  const pb = playerBox(s.playerTop, s.isDuck);
  drawDino(g, pb, s.isDuck, palette.dinoDark, palette.dino, palette.dinoBeak, s.runTime);
}

function resize(): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width = w;
  canvas.height = h;
}

function frame(now: number): void {
  const dt = lastT > 0 ? Math.min(0.05, (now - lastT) / 1000) : 0;
  lastT = now;

  if (state.phase === "running") {
    const prevScore = state.score;
    state = tickDino(
      state,
      dt,
      { wantJump: jumpQueued, duck: keys.ArrowDown },
      rng,
    );
    jumpQueued = false;
    if (state.score !== prevScore && scoreEl) {
      scoreEl.textContent = String(Math.floor(state.score));
    }
    if (state.phase === "dead") {
      storeBest(state.best);
      setHud();
      const pts = Math.floor(state.score);
      showOverlay(pts ? `${pts} pts — Space to restart` : "0 pts — Space to restart");
    }
  }

  syncCanvasLayout();
  draw(state);
  requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(stage);
window.addEventListener("resize", resize);

const bestStored = getStoredBest();
state = { ...state, best: Math.max(state.best, bestStored) };
setHud();
showOverlay("Space or tap to start");
resize();
requestAnimationFrame(frame);
