// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import {
  currentFullscreenElement,
  fullscreenToggleStrings,
  toggleFullscreenState,
} from "./fullscreen";

describe("fullscreenToggleStrings", () => {
  test("inactive uses short enter label", () => {
    const s = fullscreenToggleStrings(false);
    expect(s.text).toBe("Vollbild");
    expect(s.ariaLabel).toBe("Vollbild");
  });

  test("active asks to exit", () => {
    const s = fullscreenToggleStrings(true);
    expect(s.text).toBe("Vollbild aus");
    expect(s.ariaLabel).toBe("Vollbild beenden");
  });
});

describe("currentFullscreenElement", () => {
  test("reads standard property", () => {
    const fake = {};
    const doc = { fullscreenElement: fake, webkitFullscreenElement: null } as unknown as Document;
    expect(currentFullscreenElement(doc)).toBe(fake);
  });

  test("falls back to webkitFullscreenElement", () => {
    const fake = {};
    const doc = { fullscreenElement: null, webkitFullscreenElement: fake } as unknown as Document;
    expect(currentFullscreenElement(doc)).toBe(fake);
  });
});

describe("toggleFullscreenState", () => {
  test("calls exitFullscreen when root is fullscreen", async () => {
    const root = document.createElement("div");
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const doc = {
      fullscreenElement: root,
      exitFullscreen,
      webkitExitFullscreen: undefined as (() => void) | undefined,
      webkitFullscreenElement: null,
    } as unknown as Document;
    await toggleFullscreenState(root, doc);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  test("calls requestFullscreen when not fullscreen", async () => {
    const root = document.createElement("div");
    const req = vi.fn().mockResolvedValue(undefined);
    root.requestFullscreen = req as typeof root.requestFullscreen;
    const doc = {
      fullscreenElement: null,
      exitFullscreen: vi.fn(),
      webkitFullscreenElement: null,
    } as unknown as Document;
    await toggleFullscreenState(root, doc);
    expect(req).toHaveBeenCalledOnce();
  });

  test("webkit exit when standard missing", async () => {
    const root = document.createElement("div");
    const webkitExitFullscreen = vi.fn();
    const doc = {
      fullscreenElement: null,
      exitFullscreen: undefined as (() => Promise<void>) | undefined,
      webkitFullscreenElement: root,
      webkitExitFullscreen,
    } as unknown as Document;
    await toggleFullscreenState(root, doc);
    expect(webkitExitFullscreen).toHaveBeenCalledOnce();
  });
});
