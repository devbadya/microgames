/**
 * Content-Security-Policy for static microgames builds.
 * Tight baseline; `wasm-unsafe-eval` keeps PlayCanvas WASM paths working.
 */

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    /** PlayCanvas may compile/run WASM modules from same-origin bundles. */
    "script-src 'self' 'wasm-unsafe-eval'",
    /** Inline styles on 404 and small UI tweaks; Google Fonts CSS. */
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    /** Promo worker (HTTPS); same-origin fetch for assets and games.json */
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    /** GitHub Pages is always HTTPS */
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityMetaTagsHtml(): string {
  const csp = buildContentSecurityPolicy();
  const lines = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttr(csp)}" />`,
    `<meta http-equiv="Permissions-Policy" content="${escapeHtmlAttr(
      "camera=(), microphone=(), geolocation=(), payment=()",
    )}" />`,
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
  ];
  return `\n${lines.join("\n")}\n`;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
