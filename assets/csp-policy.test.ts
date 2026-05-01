import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  securityMetaTagsHtml,
} from "./csp-policy";

describe("buildContentSecurityPolicy", () => {
  it("locks down object/frame and allows same-origin scripts", () => {
    const p = buildContentSecurityPolicy();
    expect(p).toContain("default-src 'self'");
    expect(p).toContain("object-src 'none'");
    expect(p).toContain("frame-src 'none'");
    expect(p).toContain("script-src 'self'");
  });

  it("allows WASM for PlayCanvas bundles", () => {
    expect(buildContentSecurityPolicy()).toContain("'wasm-unsafe-eval'");
  });
});

describe("securityMetaTagsHtml", () => {
  it("emits CSP and Permissions-Policy blocks", () => {
    const html = securityMetaTagsHtml();
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("Permissions-Policy");
    expect(html).toContain("strict-origin-when-cross-origin");
  });
});
