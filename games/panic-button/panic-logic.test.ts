import { describe, expect, test } from "vitest";
import { decoyChance, scoreForHit, windowMsForRound } from "./panic-logic";

describe("panic-logic", () => {
  test("score scales with combo", () => {
    expect(scoreForHit(0)).toBe(12);
    expect(scoreForHit(3)).toBeGreaterThan(scoreForHit(0));
  });
  test("window tightens slightly", () => {
    expect(windowMsForRound(20)).toBeLessThan(windowMsForRound(0));
  });
  test("decoy ceiling", () => {
    expect(decoyChance(100)).toBe(0.55);
  });
});
