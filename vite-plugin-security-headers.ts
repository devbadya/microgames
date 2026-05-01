import type { Plugin } from "vite";

import { securityMetaTagsHtml } from "./assets/csp-policy";

/**
 * Injects CSP and related meta directives into every HTML entry in production builds.
 * (GitHub Pages cannot set arbitrary HTTP headers; meta CSP closes part of that gap.)
 */
export function securityHeadersPlugin(): Plugin {
  const snippet = securityMetaTagsHtml();
  return {
    name: "security-headers-meta",
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html;
      if (!html.includes("<head")) return html;
      return html.replace("<head>", `<head>${snippet}`);
    },
  };
}
