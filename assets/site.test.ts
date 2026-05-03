import { describe, expect, test } from "vitest";
import { publicAssetUrl, thumbUrl } from "./site-paths";

describe("publicAssetUrl", () => {
  test("root base: site-absolute path", () => {
    expect(publicAssetUrl("games/games.json", "/")).toBe("/games/games.json");
  });

  test("relative base: joins with ./", () => {
    expect(publicAssetUrl("games/games.json", "./")).toBe("./games/games.json");
    expect(publicAssetUrl("/games/games.json", "./")).toBe("./games/games.json");
    expect(publicAssetUrl("./games/games.json", "./")).toBe("./games/games.json");
  });

  test("subpath base: single slash between segments", () => {
    expect(publicAssetUrl("games/games.json", "/microgames/")).toBe("/microgames/games/games.json");
    expect(publicAssetUrl("games/games.json", "/microgames")).toBe("/microgames/games/games.json");
  });
});

describe("thumbUrl", () => {
  test("resolves manifest-relative thumbnail path", () => {
    expect(thumbUrl("./thumbnails/dino-run.svg")).toMatch(/thumbnails\/dino-run\.svg$/);
  });

  test("rejects schemes and path tricks", () => {
    expect(thumbUrl("javascript:alert(1)")).toContain("svg");
    expect(thumbUrl("//evil")).toContain("svg");
    expect(thumbUrl("../secret")).toContain("svg");
  });
});
