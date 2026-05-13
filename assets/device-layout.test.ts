/** @vitest-environment happy-dom */

import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import {
  parseDeviceLayout,
  readStoredDeviceLayout,
  writeStoredDeviceLayout,
  guessDeviceLayoutFromWidth,
  applyDeviceLayoutToDocument,
  updateDeviceLayoutButtons,
  DEVICE_LAYOUT_STORAGE_KEY,
} from "./device-layout";

beforeEach(() => {
  document.documentElement.removeAttribute("data-device-layout");
  try {
    window.localStorage.removeItem(DEVICE_LAYOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
});

describe("parseDeviceLayout", () => {
  test("accepts known values", () => {
    expect(parseDeviceLayout("phone")).toBe("phone");
    expect(parseDeviceLayout("tablet")).toBe("tablet");
    expect(parseDeviceLayout("desktop")).toBe("desktop");
  });
  test("rejects unknown", () => {
    expect(parseDeviceLayout("tv")).toBeNull();
    expect(parseDeviceLayout(null)).toBeNull();
  });
});

describe("readStoredDeviceLayout / writeStoredDeviceLayout", () => {
  test("round-trip", () => {
    const data: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    } as Storage;
    vi.stubGlobal("localStorage", ls);
    try {
      expect(readStoredDeviceLayout()).toBeNull();
      writeStoredDeviceLayout("tablet");
      expect(readStoredDeviceLayout()).toBe("tablet");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("guessDeviceLayoutFromWidth", () => {
  test("breakpoints", () => {
    expect(guessDeviceLayoutFromWidth(400)).toBe("phone");
    expect(guessDeviceLayoutFromWidth(800)).toBe("tablet");
    expect(guessDeviceLayoutFromWidth(1200)).toBe("desktop");
  });
});

describe("applyDeviceLayoutToDocument", () => {
  test("sets attribute on documentElement", () => {
    applyDeviceLayoutToDocument("phone");
    expect(document.documentElement.getAttribute("data-device-layout")).toBe("phone");
  });
});

describe("updateDeviceLayoutButtons", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("toggles aria-pressed and active class", () => {
    document.body.innerHTML = `
      <button type="button" data-set-device-layout="phone" aria-pressed="false">P</button>
      <button type="button" data-set-device-layout="desktop" aria-pressed="false">D</button>
    `;
    updateDeviceLayoutButtons("phone");
    const phone = document.querySelector("[data-set-device-layout='phone']") as HTMLButtonElement;
    const desktop = document.querySelector("[data-set-device-layout='desktop']") as HTMLButtonElement;
    expect(phone.getAttribute("aria-pressed")).toBe("true");
    expect(phone.classList.contains("deviceLayoutBtn--active")).toBe(true);
    expect(desktop.getAttribute("aria-pressed")).toBe("false");
    expect(desktop.classList.contains("deviceLayoutBtn--active")).toBe(false);
  });

  test("null clears selection", () => {
    document.body.innerHTML = `
      <button type="button" data-set-device-layout="phone" aria-pressed="true" class="deviceLayoutBtn--active">P</button>
    `;
    updateDeviceLayoutButtons(null);
    const phone = document.querySelector("[data-set-device-layout='phone']") as HTMLButtonElement;
    expect(phone.getAttribute("aria-pressed")).toBe("false");
    expect(phone.classList.contains("deviceLayoutBtn--active")).toBe(false);
  });
});
