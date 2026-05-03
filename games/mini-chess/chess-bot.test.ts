import { expect, test } from "vitest";
import {
  PType,
  algToSq,
  applyMove,
  createInitialGame,
  legalMoves,
  legalMovesFrom,
  type GameState,
} from "./chess-logic";
import { pickAiMove, searchDepthFor, type AiDifficulty } from "./chess-bot";

function emptyExcept(g: GameState, setup: [string, 0 | 1, PType][]): void {
  g.b.fill(null);
  for (const [sq, c, t] of setup) {
    g.b[algToSq(sq)] = { c, t };
  }
}

test("searchDepthFor maps difficulties", () => {
  expect(searchDepthFor("leicht")).toBe(0);
  expect(searchDepthFor("mittel")).toBe(2);
  expect(searchDepthFor("schwer")).toBe(4);
  expect(searchDepthFor("unmoeglich")).toBe(5);
});

test("pickAiMove returns only legal moves", () => {
  const g = createInitialGame();
  emptyExcept(g, [
    ["e1", 0, PType.K],
    ["e8", 1, PType.K],
  ]);
  g.side = 1;
  g.castling = 0;
  g.ep = -1;
  const legal = legalMoves(g);
  for (const diff of ["leicht", "mittel", "schwer", "unmoeglich"] as AiDifficulty[]) {
    const m = pickAiMove(g, diff);
    expect(legal.some((x) => x.from === m.from && x.to === m.to && x.promo === m.promo)).toBe(true);
  }
});

test("KI schlägt freistehende Dame wenn möglich (Minimax-Stufen)", () => {
  const g = createInitialGame();
  emptyExcept(g, [
    ["a1", 0, PType.K],
    ["d4", 0, PType.Q],
    ["e5", 1, PType.K],
  ]);
  g.side = 1;
  g.castling = 0;
  g.ep = -1;
  const cap = algToSq("d4");
  const fromK = algToSq("e5");
  for (const diff of ["mittel", "schwer", "unmoeglich"] as const) {
    const m = pickAiMove(g, diff);
    expect(m.from).toBe(fromK);
    expect(m.to).toBe(cap);
  }
});

test("leicht kann andere Züge wählen (Zufall über viele Versuche)", () => {
  const g = createInitialGame();
  applyMove(g, legalMovesFrom(g, algToSq("e2")).find((x) => x.to === algToSq("e4"))!);
  const legal = legalMoves(g);
  expect(legal.length).toBeGreaterThan(1);
  const targets = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const g2 = createInitialGame();
    applyMove(g2, legalMovesFrom(g2, algToSq("e2")).find((x) => x.to === algToSq("e4"))!);
    const m = pickAiMove(g2, "leicht");
    targets.add(m.to);
  }
  expect(targets.size).toBeGreaterThan(1);
});
