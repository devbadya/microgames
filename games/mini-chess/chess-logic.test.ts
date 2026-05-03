import { expect, test } from "vitest";
import {
  algToSq,
  createInitialGame,
  inCheck,
  inCheckBoard,
  isSquareAttacked,
  isStalemate,
  legalMoves,
  legalMovesFrom,
  applyMove,
  winnerIfCheckmate,
  sqToAlg,
  PType,
  type GameState,
} from "./chess-logic";

test("algToSq / sqToAlg round-trip", () => {
  expect(sqToAlg(algToSq("e2"))).toBe("e2");
  expect(sqToAlg(algToSq("a8"))).toBe("a8");
});

test("start position has kings and pawns", () => {
  const g = createInitialGame();
  expect(g.b[algToSq("e1")]?.t).toBe(PType.K);
  expect(g.b[algToSq("e8")]?.t).toBe(PType.K);
  expect(g.b[algToSq("e2")]?.t).toBe(PType.P);
  expect(g.b[algToSq("e7")]?.c).toBe(1);
});

test("e2-e4 is legal for white", () => {
  const g = createInitialGame();
  const ms = legalMovesFrom(g, algToSq("e2"));
  expect(ms.some((m) => sqToAlg(m.to) === "e4")).toBe(true);
});

test("after e2-e4 ep target is e3", () => {
  const g = createInitialGame();
  const m = legalMovesFrom(g, algToSq("e2")).find((x) => sqToAlg(x.to) === "e4")!;
  applyMove(g, m);
  expect(g.ep).toBe(algToSq("e3"));
});

test("scholar mate pattern: weak black allows Qxf7#", () => {
  const g = createInitialGame();
  const play = (uci: string): void => {
    const from = algToSq(uci.slice(0, 2));
    const to = algToSq(uci.slice(2, 4));
    const m = legalMoves(g).find((x) => x.from === from && x.to === to);
    expect(m).toBeTruthy();
    applyMove(g, m!);
  };
  play("e2e4");
  play("e7e5");
  play("f1c4");
  play("b8c6");
  play("d1h5");
  play("g8f6");
  play("h5f7");
  expect(winnerIfCheckmate(g)).toBe(0);
});

test("inCheckBoard detects rook attack", () => {
  const b = Array<null | { c: 0 | 1; t: PType }>(64).fill(null);
  b[algToSq("e1")] = { c: 0, t: PType.K };
  b[algToSq("e8")] = { c: 1, t: PType.K };
  b[algToSq("e5")] = { c: 1, t: PType.R };
  expect(inCheckBoard(b, 0)).toBe(true);
  expect(isSquareAttacked(b, algToSq("e1"), 1)).toBe(true);
});

function emptyExcept(g: GameState, setup: [string, 0 | 1, PType][]): void {
  g.b.fill(null);
  for (const [sq, c, t] of setup) {
    g.b[algToSq(sq)] = { c, t };
  }
}

test("stalemate: Ka8 vs Qb6", () => {
  const g = createInitialGame();
  g.side = 1;
  emptyExcept(g, [
    ["a8", 1, PType.K],
    ["b6", 0, PType.Q],
  ]);
  g.castling = 0;
  g.ep = -1;
  expect(inCheck(g)).toBe(false);
  expect(legalMoves(g).length).toBe(0);
  expect(isStalemate(g)).toBe(true);
});
