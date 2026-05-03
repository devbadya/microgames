/**
 * Mini-Schach — 8×8, Standardzüge.
 * Index: file 0=a … 7=h, rank 0 = Achte (oben) … 7 = Erste (unten, Weiß hinten).
 * Weiß zieht Richtung Rang 8 (rank-Index −1), Schwarz Richtung Rang 1 (+1).
 */

export type Color = 0 | 1;

export const enum PType {
  P = 1,
  N,
  B,
  R,
  Q,
  K,
}

export type Cell = null | { c: Color; t: PType };

export interface GameState {
  b: Cell[];
  side: Color;
  castling: number;
  /** Feld, auf das ein Bauer en passant schlägt (wie FEN-Zielfeld), sonst -1 */
  ep: number;
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: PType.Q;
  epCapture?: number;
  castleRookFrom?: number;
}

const FILES = "abcdefgh";

const PT: Record<string, PType> = {
  R: PType.R,
  N: PType.N,
  B: PType.B,
  Q: PType.Q,
  K: PType.K,
};

export function sq(file: number, rank: number): number {
  return file + rank * 8;
}

export function fileOf(s: number): number {
  return s % 8;
}

export function rankOf(s: number): number {
  return (s / 8) | 0;
}

export function sqToAlg(s: number): string {
  return `${FILES[fileOf(s)]!}${8 - rankOf(s)}`;
}

export function algToSq(a: string): number {
  const f = FILES.indexOf(a[0]!);
  const r = 8 - Number(a[1]);
  return sq(f, r);
}

export function opponent(c: Color): Color {
  return (1 - c) as Color;
}

export function cloneState(g: GameState): GameState {
  return {
    b: g.b.slice(),
    side: g.side,
    castling: g.castling,
    ep: g.ep,
    halfmove: g.halfmove,
    fullmove: g.fullmove,
  };
}

export function createInitialGame(): GameState {
  const b: Cell[] = Array(64).fill(null);
  const back = "RNBQKBNR";
  for (let i = 0; i < 8; i++) {
    const f = FILES[i]!;
    const t = PT[back[i]!]!;
    b[algToSq(`${f}8`)] = { c: 1, t };
    b[algToSq(`${f}1`)] = { c: 0, t };
    b[algToSq(`${f}7`)] = { c: 1, t: PType.P };
    b[algToSq(`${f}2`)] = { c: 0, t: PType.P };
  }
  return {
    b,
    side: 0,
    castling: 0b1111,
    ep: -1,
    halfmove: 0,
    fullmove: 1,
  };
}

function kingSq(board: Cell[], color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.c === color && p.t === PType.K) return i;
  }
  return -1;
}

/** Steht `color`-König auf dem Brett nach Schach? */
export function inCheckBoard(board: Cell[], color: Color): boolean {
  const k = kingSq(board, color);
  if (k < 0) return false;
  return isSquareAttacked(board, k, opponent(color));
}

export function inCheck(g: GameState): boolean {
  return inCheckBoard(g.b, g.side);
}

const KN: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

export function isSquareAttacked(board: Cell[], target: number, byColor: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);

  for (const [df, dr] of KN) {
    const f = tf + df;
    const r = tr + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = board[sq(f, r)];
      if (p && p.c === byColor && p.t === PType.N) return true;
    }
  }

  const prFrom = byColor === 0 ? tr + 1 : tr - 1;
  for (const df of [-1, 1]) {
    const f = tf + df;
    const r = prFrom;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = board[sq(f, r)];
      if (p && p.c === byColor && p.t === PType.P) return true;
    }
  }

  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = tf + df;
      const r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[sq(f, r)];
      if (p && p.c === byColor && p.t === PType.K) return true;
    }
  }

  for (const [df, dr] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = board[sq(f, r)];
      if (p) {
        if (p.c === byColor && (p.t === PType.B || p.t === PType.Q)) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  for (const [df, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = board[sq(f, r)];
      if (p) {
        if (p.c === byColor && (p.t === PType.R || p.t === PType.Q)) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

function stripCastlingFromRookOrKing(g: GameState, sqMoved: number): void {
  const clear: Record<number, number> = {
    [algToSq("e1")]: 1 | 2,
    [algToSq("e8")]: 4 | 8,
    [algToSq("h1")]: 1,
    [algToSq("a1")]: 2,
    [algToSq("h8")]: 4,
    [algToSq("a8")]: 8,
  };
  const bits = clear[sqMoved];
  if (bits !== undefined) g.castling &= ~bits;
}

export function applyMove(g: GameState, m: Move): void {
  const { b } = g;
  const moving = b[m.from]!;
  const cap = b[m.to];

  if (m.castleRookFrom !== undefined) {
    b[m.to] = moving;
    b[m.from] = null;
    const rk = b[m.castleRookFrom]!;
    const rookTo = m.to + (m.to > m.from ? -1 : 1);
    b[m.castleRookFrom] = null;
    b[rookTo] = rk;
  } else if (m.epCapture !== undefined) {
    b[m.to] = moving;
    b[m.from] = null;
    b[m.epCapture] = null;
  } else {
    b[m.to] = m.promo ? { c: moving.c, t: PType.Q } : moving;
    b[m.from] = null;
  }

  if (moving.t === PType.P && Math.abs(m.to - m.from) === 16) {
    g.ep = (m.from + m.to) >> 1;
  } else {
    g.ep = -1;
  }

  if (moving.t === PType.P || cap) g.halfmove = 0;
  else g.halfmove++;

  if (moving.c === 1) g.fullmove++;

  stripCastlingFromRookOrKing(g, m.from);
  if (cap?.t === PType.R) stripCastlingFromRookOrKing(g, m.to);

  g.side = opponent(g.side);
}

function pseudoMovesForSquare(g: GameState, from: number): Move[] {
  const p = g.b[from];
  if (!p || p.c !== g.side) return [];
  const out: Move[] = [];
  const f0 = fileOf(from);
  const r0 = rankOf(from);

  const add = (to: number, extra?: Partial<Move>) => {
    if (to < 0 || to > 63) return;
    const t = g.b[to];
    if (t && t.c === p.c) return;
    out.push({ from, to, ...extra });
  };

  if (p.t === PType.P) {
    const dir = p.c === 0 ? -1 : 1;
    const startRank = p.c === 0 ? 6 : 1;
    const pr = r0 + dir;
    if (pr >= 0 && pr < 8) {
      const s1 = sq(f0, pr);
      if (!g.b[s1]) {
        if ((p.c === 0 && pr === 0) || (p.c === 1 && pr === 7)) add(s1, { promo: PType.Q });
        else add(s1);
        if (r0 === startRank) {
          const s2 = sq(f0, r0 + dir * 2);
          if (!g.b[s2]) add(s2);
        }
      }
    }
    for (const df of [-1, 1]) {
      const f = f0 + df;
      const r = r0 + dir;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const s = sq(f, r);
      const occ = g.b[s];
      if (occ && occ.c !== p.c) {
        if ((p.c === 0 && r === 0) || (p.c === 1 && r === 7)) add(s, { promo: PType.Q });
        else add(s);
      }
      if (g.ep >= 0 && s === g.ep) {
        const victimSq = sq(fileOf(g.ep), r0);
        const victim = g.b[victimSq];
        if (victim && victim.c !== p.c && victim.t === PType.P) {
          out.push({ from, to: s, epCapture: victimSq });
        }
      }
    }
  } else if (p.t === PType.N) {
    for (const [df, dr] of KN) {
      const f = f0 + df;
      const r = r0 + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) add(sq(f, r));
    }
  } else if (p.t === PType.K) {
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const f = f0 + df;
        const r = r0 + dr;
        if (f >= 0 && f < 8 && r >= 0 && r < 8) add(sq(f, r));
      }
    }
    if (p.c === 0 && from === algToSq("e1")) {
      if ((g.castling & 1) && !g.b[algToSq("f1")] && !g.b[algToSq("g1")]) {
        out.push({ from, to: algToSq("g1"), castleRookFrom: algToSq("h1") });
      }
      if ((g.castling & 2) && !g.b[algToSq("d1")] && !g.b[algToSq("c1")] && !g.b[algToSq("b1")]) {
        out.push({ from, to: algToSq("c1"), castleRookFrom: algToSq("a1") });
      }
    }
    if (p.c === 1 && from === algToSq("e8")) {
      if ((g.castling & 4) && !g.b[algToSq("f8")] && !g.b[algToSq("g8")]) {
        out.push({ from, to: algToSq("g8"), castleRookFrom: algToSq("h8") });
      }
      if ((g.castling & 8) && !g.b[algToSq("d8")] && !g.b[algToSq("c8")] && !g.b[algToSq("b8")]) {
        out.push({ from, to: algToSq("c8"), castleRookFrom: algToSq("a8") });
      }
    }
  } else {
    const dirs =
      p.t === PType.R
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : p.t === PType.B
          ? [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ];
    for (const [df, dr] of dirs) {
      let f = f0 + df;
      let r = r0 + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const s = sq(f, r);
        const occ = g.b[s];
        if (!occ) {
          add(s);
        } else {
          if (occ.c !== p.c) add(s);
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return out;
}

function boardAfter(g: GameState, m: Move): Cell[] {
  const cp = cloneState(g);
  applyMove(cp, m);
  return cp.b;
}

function filterLegal(g: GameState, moves: Move[]): Move[] {
  const ok: Move[] = [];
  for (const m of moves) {
    const nb = boardAfter(g, m);
    if (!inCheckBoard(nb, g.side)) ok.push(m);
  }
  return ok;
}

function castlingBlockedByCheck(g: GameState, m: Move): boolean {
  if (m.castleRookFrom === undefined) return false;
  const step = m.to > m.from ? 1 : -1;
  for (let s = m.from + step; step > 0 ? s <= m.to : s >= m.to; s += step) {
    const nb = g.b.slice();
    const king = g.b[m.from]!;
    nb[m.from] = null;
    nb[s] = king;
    if (inCheckBoard(nb, g.side)) return true;
  }
  return false;
}

export function legalMoves(g: GameState): Move[] {
  const all: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const ms = pseudoMovesForSquare(g, i);
    for (const m of ms) {
      if (m.castleRookFrom !== undefined) {
        if (inCheck(g)) continue;
        const mid = (m.from + m.to) >> 1;
        if (g.b[mid]) continue;
        if (castlingBlockedByCheck(g, m)) continue;
      }
      all.push(m);
    }
  }
  return filterLegal(g, all);
}

export function legalMovesFrom(g: GameState, from: number): Move[] {
  return legalMoves(g).filter((m) => m.from === from);
}

/** Farbe des Gewinners, oder null */
export function winnerIfCheckmate(g: GameState): Color | null {
  if (!inCheck(g)) return null;
  if (legalMoves(g).length > 0) return null;
  return opponent(g.side);
}

export function isStalemate(g: GameState): boolean {
  if (inCheck(g)) return false;
  return legalMoves(g).length === 0;
}

export function parseUci(uci: string): Move | null {
  if (uci.length < 4) return null;
  const from = algToSq(uci.slice(0, 2));
  const to = algToSq(uci.slice(2, 4));
  const promo = uci[4] === "q" ? PType.Q : undefined;
  return { from, to, promo };
}
