import { describe, expect, it } from "vitest";
import { parseSignalingRoom, parseSignalingWireMessage } from "./webrtc-p2p";

describe("parseSignalingRoom", () => {
  it("reads room query param", () => {
    expect(parseSignalingRoom("ws://127.0.0.1:5800?room=ab")).toBe("ab");
  });

  it("trims room", () => {
    expect(parseSignalingRoom("ws://h/?room=%20x%20")).toBe("x");
  });

  it("defaults when missing or empty", () => {
    expect(parseSignalingRoom("ws://h/")).toBe("default");
    expect(parseSignalingRoom("ws://h/?room=")).toBe("default");
    expect(parseSignalingRoom("ws://h/?room=   ")).toBe("default");
  });

  it("returns default on invalid URL", () => {
    expect(parseSignalingRoom("not-a-url")).toBe("default");
  });
});

describe("parseSignalingWireMessage", () => {
  it("parses signal-meta messages", () => {
    expect(parseSignalingWireMessage({ type: "signal-meta", waiting: true })).toEqual({
      type: "signal-meta",
      waiting: true,
    });
    expect(parseSignalingWireMessage({ type: "signal-meta", role: "offerer" })).toEqual({
      type: "signal-meta",
      role: "offerer",
    });
  });

  it("parses relay messages", () => {
    expect(
      parseSignalingWireMessage({ type: "offer", sdp: "v=0\r\n" }),
    ).toEqual({ type: "offer", sdp: "v=0\r\n" });
    expect(
      parseSignalingWireMessage({ type: "answer", sdp: "v=0\r\n" }),
    ).toEqual({ type: "answer", sdp: "v=0\r\n" });
    expect(parseSignalingWireMessage({ type: "ice", candidate: null })).toEqual({
      type: "ice",
      candidate: null,
    });
    expect(
      parseSignalingWireMessage({
        type: "ice",
        candidate: { candidate: "c", sdpMid: "0" },
      }),
    ).toEqual({
      type: "ice",
      candidate: { candidate: "c", sdpMid: "0" },
    });
  });

  it("rejects invalid payloads", () => {
    expect(parseSignalingWireMessage(null)).toBeNull();
    expect(parseSignalingWireMessage("x")).toBeNull();
    expect(parseSignalingWireMessage({})).toBeNull();
    expect(parseSignalingWireMessage({ type: "signal-meta" })).toBeNull();
    expect(parseSignalingWireMessage({ type: "signal-meta", role: "x" })).toBeNull();
    expect(parseSignalingWireMessage({ type: "offer" })).toBeNull();
    expect(parseSignalingWireMessage({ type: "ice" })).toBeNull();
    expect(parseSignalingWireMessage({ type: "ice", candidate: "bad" })).toBeNull();
  });
});
