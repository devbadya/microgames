import "./style.css";
import { pickAiMove, type AiDifficulty } from "./chess-bot";
import {
  PType,
  applyMove,
  createInitialGame,
  fileOf,
  inCheck,
  isStalemate,
  legalMovesFrom,
  rankOf,
  sq,
  winnerIfCheckmate,
  type Move,
} from "./chess-logic";

const CELL = 60;
const W = 8 * CELL;
const H = 8 * CELL;

const PIECE_W: Record<PType, string> = {
  [PType.K]: "♔",
  [PType.Q]: "♕",
  [PType.R]: "♖",
  [PType.B]: "♗",
  [PType.N]: "♘",
  [PType.P]: "♙",
};
const PIECE_B: Record<PType, string> = {
  [PType.K]: "♚",
  [PType.Q]: "♛",
  [PType.R]: "♜",
  [PType.B]: "♝",
  [PType.N]: "♞",
  [PType.P]: "♟",
};

const DIFF_STORAGE = "mini-chess-ai-difficulty";

let g = createInitialGame();
let selected: number | null = null;
let legalFromSel: Move[] = [];
let botThinking = false;
let aiDifficulty: AiDifficulty = "mittel";

const canvas = document.getElementById("mcBoard") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("mcStatus")!;
const turnEl = document.getElementById("mcTurn")!;

function loadDifficulty(): AiDifficulty {
  try {
    const v = localStorage.getItem(DIFF_STORAGE);
    if (v === "leicht" || v === "mittel" || v === "schwer" || v === "unmoeglich") return v;
  } catch {
    /* ignore */
  }
  return "mittel";
}

function saveDifficulty(d: AiDifficulty): void {
  try {
    localStorage.setItem(DIFF_STORAGE, d);
  } catch {
    /* ignore */
  }
}

function syncDifficultyRadios(): void {
  for (const el of document.querySelectorAll<HTMLInputElement>('input[name="mcDiff"]')) {
    el.checked = el.value === aiDifficulty;
  }
}

function botDelayMs(): number {
  switch (aiDifficulty) {
    case "leicht":
      return 160;
    case "mittel":
      return 220;
    case "schwer":
      return 280;
    case "unmoeglich":
      return 360;
    default:
      return 220;
  }
}

function gameOverText(): string | null {
  const w = winnerIfCheckmate(g);
  if (w === 0) return "Matt — du gewinnst!";
  if (w === 1) return "Matt — die KI gewinnt.";
  if (isStalemate(g)) return "Patt — unentschieden.";
  return null;
}

function syncHud(): void {
  const over = gameOverText();
  if (over) {
    statusEl.textContent = over;
    turnEl.textContent = "Partie beendet";
    return;
  }
  if (inCheck(g)) {
    statusEl.textContent =
      g.side === 0 ? "Du stehst im Schach." : "Die KI steht im Schach (dein Zug folgt).";
  } else {
    statusEl.textContent = g.side === 0 ? "Du bist am Zug." : "Die KI zieht …";
  }
  turnEl.textContent = g.side === 0 ? "Du (Weiß) am Zug" : "KI (Schwarz) am Zug";
}

function draw(): void {
  ctx.clearRect(0, 0, W, H);
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const light = (f + r) % 2 === 0;
      ctx.fillStyle = light ? "#e2e8f0" : "#64748b";
      ctx.fillRect(f * CELL, r * CELL, CELL, CELL);
    }
  }

  const hi = new Set<number>();
  for (const m of legalFromSel) hi.add(m.to);
  if (selected !== null) hi.add(selected);
  for (const s of hi) {
    const f = fileOf(s);
    const r = rankOf(s);
    ctx.fillStyle = "rgba(56, 189, 248, 0.42)";
    ctx.fillRect(f * CELL, r * CELL, CELL, CELL);
  }

  for (let i = 0; i < 64; i++) {
    const p = g.b[i];
    if (!p) continue;
    const f = fileOf(i);
    const r = rankOf(i);
    const ch = p.c === 0 ? PIECE_W[p.t]! : PIECE_B[p.t]!;
    ctx.font = `${CELL * 0.62}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.c === 0 ? "#0f172a" : "#020617";
    ctx.fillText(ch, f * CELL + CELL * 0.5, r * CELL + CELL * 0.52);
  }

  const w = winnerIfCheckmate(g);
  if (w !== null || isStalemate(g)) return;
  if (inCheck(g)) {
    for (let i = 0; i < 64; i++) {
      const p = g.b[i];
      if (p && p.t === PType.K && p.c === g.side) {
        const f = fileOf(i);
        const r = rankOf(i);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 4;
        ctx.strokeRect(f * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6);
        break;
      }
    }
  }
}

function screenToSq(clientX: number, clientY: number, el: HTMLCanvasElement): number | null {
  const rect = el.getBoundingClientRect();
  const scaleX = el.width / rect.width;
  const scaleY = el.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const f = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return sq(f, r);
}

function tryHumanMove(to: number): void {
  if (g.side !== 0 || botThinking) return;
  if (selected === null) return;
  const m = legalFromSel.find((x) => x.to === to);
  if (!m) return;
  applyMove(g, m);
  selected = null;
  legalFromSel = [];
  syncHud();
  draw();
  runBotIfNeeded();
}

function runBotIfNeeded(): void {
  const over = gameOverText();
  if (over || g.side !== 1) return;
  botThinking = true;
  syncHud();
  window.setTimeout(() => {
    const m = pickAiMove(g, aiDifficulty);
    applyMove(g, m);
    botThinking = false;
    syncHud();
    draw();
  }, botDelayMs());
}

function onPointer(ev: PointerEvent): void {
  if (gameOverText()) return;
  const sqHit = screenToSq(ev.clientX, ev.clientY, canvas);
  if (sqHit === null) return;

  if (g.side !== 0) return;

  if (selected === null) {
    const p = g.b[sqHit];
    if (p && p.c === 0) {
      selected = sqHit;
      legalFromSel = legalMovesFrom(g, sqHit);
      if (legalFromSel.length === 0) {
        selected = null;
      }
    }
  } else {
    if (sqHit === selected) {
      selected = null;
      legalFromSel = [];
    } else {
      tryHumanMove(sqHit);
      return;
    }
  }
  syncHud();
  draw();
}

function newGame(): void {
  g = createInitialGame();
  selected = null;
  legalFromSel = [];
  botThinking = false;
  syncHud();
  draw();
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  onPointer(e);
});

document.getElementById("mcNew")?.addEventListener("click", newGame);

for (const el of document.querySelectorAll<HTMLInputElement>('input[name="mcDiff"]')) {
  el.addEventListener("change", () => {
    if (!el.checked) return;
    const v = el.value;
    if (v === "leicht" || v === "mittel" || v === "schwer" || v === "unmoeglich") {
      aiDifficulty = v;
      saveDifficulty(v);
    }
  });
}

aiDifficulty = loadDifficulty();
syncDifficultyRadios();
newGame();
