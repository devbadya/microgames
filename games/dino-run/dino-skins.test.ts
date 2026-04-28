import { describe, expect, it } from "vitest";
import { DINO_SKIN_IDS, getSkinBitmaps } from "./dino-skins";

describe("dino skins", () => {
  it("exposes four run frames per skin with consistent row widths", () => {
    for (const id of DINO_SKIN_IDS) {
      const s = getSkinBitmaps(id);
      expect(s.runFrames).toHaveLength(4);
      for (const frame of s.runFrames) {
        const w = frame[0]?.length ?? 0;
        expect(w).toBeGreaterThan(0);
        for (const row of frame) {
          expect(row.length).toBe(w);
        }
      }
    }
  });
});
