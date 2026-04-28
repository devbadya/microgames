import { describe, expect, it } from "vitest";
import {
  normalizeHex,
  OFFLINE_DINO_SPRITES,
  shadeFromBody,
} from "./dino-skins";

describe("dino skins", () => {
  it("normalizes shorthand hex colour", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("#AaBbCc")).toBe("#aabbcc");
  });

  it("computes darker shade stripe from body hex", () => {
    expect(shadeFromBody("#535353")).toMatch(/^#/);
    const d = shadeFromBody("#ffffff", 0.5);
    expect(normalizeHex(d)).toBe("#808080");
  });

  it("exposes four run frames with consistent row widths", () => {
    for (const frame of OFFLINE_DINO_SPRITES.runFrames) {
      const w = frame[0]?.length ?? 0;
      expect(w).toBeGreaterThan(0);
      for (const row of frame) {
        expect(row.length).toBe(w);
      }
    }
  });
});
