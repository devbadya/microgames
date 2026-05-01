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
      expect(frame[0]?.length).toBe(43);
      for (const row of frame) {
        expect(row.length).toBe(43);
      }
      expect(frame.some((row) => row.includes("O"))).toBe(true);
    }
  });

  /** Jump uses the same raster size as runs so scaling does not snap between poses. */
  it("jump sprite matches run grid size and widths", () => {
    const { jump, runFrames } = OFFLINE_DINO_SPRITES;
    expect(jump.length).toBe(runFrames[0].length);
    for (const row of jump) expect(row.length).toBe(43);
    expect(jump.some((row) => row.includes("O"))).toBe(true);
  });

  /** Same-width duck grid as stand hitbox keeps pixel size stable when swapping from run ↔ duck. */
  it("duck sprites are 43×28 with eye pixel and aligned foot row", () => {
    const { duck0, duck1 } = OFFLINE_DINO_SPRITES;
    expect(duck0.length).toBe(28);
    expect(duck1.length).toBe(duck0.length);
    for (const row of duck0) expect(row.length).toBe(43);
    for (const row of duck1) expect(row.length).toBe(43);
    expect(duck0.some((row) => row.includes("O"))).toBe(true);
    expect(duck0.some((row, i) => row !== duck1[i])).toBe(true);
    const low = (rows: readonly string[]) => {
      let m = -1;
      for (let r = 0; r < rows.length; r++) if (/[#O]/.test(rows[r])) m = r;
      return m;
    };
    expect(low(duck0)).toBe(low(duck1));
  });

  /** Running frames share the same lowest body row so feet stay on the horizon while animating. */
  it("run frames align on bottom-most body row", () => {
    const frames = OFFLINE_DINO_SPRITES.runFrames;
    let ref = -1;
    for (let r = 0; r < frames[0].length; r++)
      if (/[#O]/.test(frames[0][r] ?? "")) ref = r;
    expect(ref).toBeGreaterThanOrEqual(0);
    for (const frame of frames) {
      let mi = -1;
      for (let r = 0; r < frame.length; r++) if (/[#O]/.test(frame[r] ?? "")) mi = r;
      expect(mi).toBe(ref);
    }
  });
});
