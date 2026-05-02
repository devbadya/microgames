/**
 * Content-Security-Policy for static microgames builds.
 *
 * The site has no backend, so there are no API endpoints that need carve-outs.
 * The hardening goals here are:
 *   - Block remote scripts (`script-src 'self'`); allow WASM for PlayCanvas.
 *   - Disallow inline event handlers (`script-src` has no `'unsafe-inline'`).
 *   - Forbid framing the site (`frame-ancestors 'none'`) and only allow form
 *     submissions back to the same origin (`form-action 'self'`).
 *   - Restrict stylesheets to same-origin + Google Fonts CSS only.
 *   - Restrict images and fonts to same-origin + safe data/blob refs.
 *
 * `style-src` still keeps `'unsafe-inline'` because per-game pages ship
 * their own scoped <style> blocks; relaxing it elsewhere is fine because
 * `script-src` is locked down.
 */

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    /** PlayCanvas may compile/run WASM modules from same-origin bundles. */
    "script-src 'self' 'wasm-unsafe-eval'",
    /** Inline styles on game pages and small UI tweaks; Google Fonts CSS. */
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    /** Promo worker (HTTPS); same-origin fetch for assets and games.json. */
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    /** GitHub Pages is always HTTPS. */
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityMetaTagsHtml(): string {
  const csp = buildContentSecurityPolicy();
  const lines = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttr(csp)}" />`,
    `<meta http-equiv="Permissions-Policy" content="${escapeHtmlAttr(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
    )}" />`,
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
    `<meta http-equiv="X-Content-Type-Options" content="nosniff" />`,
  ];
  return `\n${lines.join("\n")}\n`;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
