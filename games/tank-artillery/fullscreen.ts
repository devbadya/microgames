/** Sichtbare und assistive Beschriftung für den Vollbild-Schalter (DE). */
export function fullscreenToggleStrings(active: boolean): { ariaLabel: string; title: string; text: string } {
  return active
    ? {
        ariaLabel: "Vollbild beenden",
        title: "Vollbild beenden (Esc)",
        text: "Vollbild aus",
      }
    : {
        ariaLabel: "Vollbild",
        title: "Vollbild",
        text: "Vollbild",
      };
}

export function currentFullscreenElement(doc: Document): Element | null {
  const d = doc as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/**
 * Wechselt Vollbild für `root`; `doc` separat übergeben → in Unit-Tests mit minimalem Stub testbar.
 * Fehler werden geschluckt (z. B. Blockierung durch Browser/OS).
 */
export async function toggleFullscreenState(root: HTMLElement, doc: Document): Promise<void> {
  if (currentFullscreenElement(doc) === root) {
    const d = doc as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    if (doc.exitFullscreen) {
      await doc.exitFullscreen().catch(() => {});
    } else if (d.webkitExitFullscreen) {
      await Promise.resolve(d.webkitExitFullscreen()).catch(() => {});
    }
    return;
  }
  const el = root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  if (root.requestFullscreen) {
    await root.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    await Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
  }
}

export function toggleRootFullscreen(root: HTMLElement): Promise<void> {
  return toggleFullscreenState(root, root.ownerDocument);
}
