import {
  PType,
  applyMove,
  cloneState,
  inCheck,
  legalMoves,
  type GameState,
  type Move,
} from "./chess-logic";

export type AiDifficulty = "leicht" | "mittel" | "schwer" | "unmoeglich";

const PIECE_VAL: Record<PType, number> = {
  [PType.P]: 100,
  [PType.N]: 320,
  [PType.B]: 330,
  [PType.R]: 500,
  [PType.Q]: 900,
  [PType.K]: 20_000,
};

const MATE = 50_000;

/** Suchtiefe in Halbzügen ab dem Zug der KI (nur für Minimax-Stufen). */
const SEARCH_DEPTH: Record<Exclude<AiDifficulty, "leicht">, number> = {
  mittel: 2,
  schwer: 4,
  /** Eine Halbzug-Ebene mehr als „Schwer“; tiefere Suche würde im Browser spürbar ruckeln. */
  unmoeglich: 5,
};

export function searchDepthFor(diff: AiDifficulty): number {
  if (diff === "leicht") return 0;
  return SEARCH_DEPTH[diff];
}

function materialWhiteMinusBlack(s: GameState): number {
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (!p) continue;
    const v = PIECE_VAL[p.t] ?? 0;
    sum += p.c === 0 ? v : -v;
  }
  return sum;
}

/** Bewertung aus Sicht des am Zug befindlichen Spielers (positiv = gut für ihn). */
function staticEval(s: GameState): number {
  const m = materialWhiteMinusBlack(s);
  return s.side === 0 ? m : -m;
}

function captureSortKey(s: GameState, m: Move): number {
  const cap = s.b[m.to];
  if (!cap) return 0;
  const vCap = PIECE_VAL[cap.t] ?? 0;
  const vFrom = PIECE_VAL[s.b[m.from]!.t] ?? 0;
  return 1000 + vCap * 10 - vFrom;
}

function sortMovesForSearch(s: GameState, moves: Move[]): void {
  moves.sort((a, b) => captureSortKey(s, b) - captureSortKey(s, a));
}

function negamax(state: GameState, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(state);
  if (!moves.length) {
    if (inCheck(state)) return -(MATE - depth);
    return 0;
  }
  if (depth <= 0) return staticEval(state);

  sortMovesForSearch(state, moves);
  let best = -Infinity;
  for (const m of moves) {
    const cp = cloneState(state);
    applyMove(cp, m);
    const sc = -negamax(cp, depth - 1, -beta, -alpha);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function pickBestMinimax(state: GameState, depth: number): Move {
  const moves = legalMoves(state);
  if (!moves.length) return moves[0]!;
  sortMovesForSearch(state, moves);
  let bestM = moves[0]!;
  let bestSc = -Infinity;
  let alpha = -Infinity;
  const beta0 = Infinity;
  for (const m of moves) {
    const cp = cloneState(state);
    applyMove(cp, m);
    const sc = -negamax(cp, depth - 1, -beta0, -alpha);
    if (sc > bestSc) {
      bestSc = sc;
      bestM = m;
    }
    alpha = Math.max(alpha, bestSc);
  }
  return bestM;
}

/**
 * Wählt einen legalen Zug für Schwarz (KI). `leicht` = zufällig, sonst Minimax mit fester Tiefe.
 */
export function pickAiMove(state: GameState, diff: AiDifficulty): Move {
  const moves = legalMoves(state);
  if (!moves.length) return moves[0]!;
  if (diff === "leicht") {
    return moves[Math.floor(Math.random() * moves.length)]!;
  }
  const depth = SEARCH_DEPTH[diff];
  return pickBestMinimax(state, depth);
}
