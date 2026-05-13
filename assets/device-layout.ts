/** Preferred layout for the landing site: touch targets, grid, typography */

export type DeviceLayout = "phone" | "tablet" | "desktop";

export const DEVICE_LAYOUT_STORAGE_KEY = "microgames.deviceLayout";

export function parseDeviceLayout(raw: unknown): DeviceLayout | null {
  if (raw === "phone" || raw === "tablet" || raw === "desktop") return raw;
  return null;
}

export function readStoredDeviceLayout(): DeviceLayout | null {
  try {
    return parseDeviceLayout(window.localStorage.getItem(DEVICE_LAYOUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredDeviceLayout(layout: DeviceLayout): void {
  try {
    window.localStorage.setItem(DEVICE_LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
}

/** Heuristic for optional defaults (not shown as auto-pick unless we add that later). */
export function guessDeviceLayoutFromWidth(width: number): DeviceLayout {
  if (width < 640) return "phone";
  if (width < 1100) return "tablet";
  return "desktop";
}

export function applyDeviceLayoutToDocument(
  layout: DeviceLayout,
  docEl: HTMLElement = document.documentElement,
): void {
  docEl.setAttribute("data-device-layout", layout);
}

export function updateDeviceLayoutButtons(layout: DeviceLayout | null): void {
  document.querySelectorAll<HTMLButtonElement>("[data-set-device-layout]").forEach((btn) => {
    const v = btn.getAttribute("data-set-device-layout") as DeviceLayout | null;
    const on = layout !== null && v === layout;
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("deviceLayoutBtn--active", on);
  });
}
