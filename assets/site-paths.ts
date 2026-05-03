/**
 * URLs for static files from `public/`, honoring Vite `import.meta.env.BASE_URL`
 * (e.g. `/` in local dev, `/microgames/` on GitHub Pages).
 */

/**
 * Build URL for a file copied from `public/` into the site root.
 */
export function publicAssetUrl(rel: string, baseUrl: string = import.meta.env.BASE_URL): string {
  const path = String(rel ?? "")
    .trim()
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
  if (baseUrl === "./") {
    return `./${path}`;
  }
  const b = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${b}${path}`;
}

/**
 * Convert a manifest thumbnail reference to a safe URL.
 *
 * Hardened against javascript:/data: scheme abuse — only local/relative roots are honoured.
 * Anything suspicious collapses to a transparent placeholder so a poisoned games.json can't smuggle script.
 */
export function thumbUrl(rel: string): string {
  const trimmed = String(rel ?? "").trim();
  if (!trimmed) return "data:image/svg+xml;utf8,%3Csvg/%3E";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return "data:image/svg+xml;utf8,%3Csvg/%3E";
  }
  if (trimmed.startsWith("//")) return "data:image/svg+xml;utf8,%3Csvg/%3E";
  const local = trimmed.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  if (!local || local.includes("..")) return "data:image/svg+xml;utf8,%3Csvg/%3E";
  return publicAssetUrl(local);
}
