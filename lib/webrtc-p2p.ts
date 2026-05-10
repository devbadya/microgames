/**
 * Browser WebRTC helper: JSON over an RTCDataChannel, SDP + ICE via WebSocket relay.
 * Dev signaling: `pnpm run webrtc-stub` → ws://127.0.0.1:5800?room=demo
 */

export const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type P2pRole = "offerer" | "answerer";

export type SignalMetaMessage =
  | { type: "signal-meta"; waiting: true }
  | { type: "signal-meta"; role: P2pRole };

export type ClientRelayMessage =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit | null };

export type SignalingWireMessage = SignalMetaMessage | ClientRelayMessage;

export interface P2pJsonChannelResult {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  role: P2pRole;
  close: () => void;
}

export interface ConnectP2pJsonChannelOptions {
  signalingUrl: string;
  rtcConfig?: RTCConfiguration;
  channelLabel?: string;
  channelOptions?: RTCDataChannelInit;
  /** When aborted, closes the signaling socket and peer connection (e.g. user cancels matchmaking). */
  signal?: AbortSignal;
}

export function parseSignalingRoom(signalingUrl: string): string {
  try {
    const u = new URL(signalingUrl);
    const r = u.searchParams.get("room");
    return r != null && r.trim() !== "" ? r.trim() : "default";
  } catch {
    return "default";
  }
}

export function parseSignalingWireMessage(raw: unknown): SignalingWireMessage | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "signal-meta") {
    if (o.waiting === true) return { type: "signal-meta", waiting: true };
    if (o.role === "offerer" || o.role === "answerer") {
      return { type: "signal-meta", role: o.role };
    }
    return null;
  }
  if (o.type === "offer" && typeof o.sdp === "string") {
    return { type: "offer", sdp: o.sdp };
  }
  if (o.type === "answer" && typeof o.sdp === "string") {
    return { type: "answer", sdp: o.sdp };
  }
  if (o.type === "ice") {
    const c = o.candidate;
    if (c === null) return { type: "ice", candidate: null };
    if (c != null && typeof c === "object") {
      return { type: "ice", candidate: c as RTCIceCandidateInit };
    }
    return null;
  }
  return null;
}

function defaultRtcConfig(rtcConfig?: RTCConfiguration): RTCConfiguration {
  const { iceServers: extraIce, ...rest } = rtcConfig ?? {};
  return {
    iceServers: [...DEFAULT_STUN_SERVERS, ...(extraIce ?? [])],
    ...rest,
  };
}

function waitForOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebSocket failed to open"));
    };
    const cleanup = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
    };
    ws.addEventListener("open", onOpen);
    ws.addEventListener("error", onError);
  });
}

async function flushIce(
  pc: RTCPeerConnection,
  pending: (RTCIceCandidateInit | null)[],
): Promise<void> {
  while (pending.length > 0) {
    const c = pending.shift();
    try {
      await pc.addIceCandidate(c ?? null);
    } catch {
      /* ignore invalid or late ICE */
    }
  }
}

function waitDataChannelOpen(ch: RTCDataChannel): Promise<void> {
  if (ch.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    ch.onopen = () => resolve();
    ch.onerror = () => reject(new Error("RTCDataChannel failed to open"));
  });
}

/**
 * Opens a WebSocket to a relay, negotiates WebRTC, resolves when the data channel is open.
 */
export async function connectP2pJsonChannel(
  opts: ConnectP2pJsonChannelOptions,
): Promise<P2pJsonChannelResult> {
  const label = opts.channelLabel ?? "p2p-json";
  const rtcConfig = defaultRtcConfig(opts.rtcConfig);
  const ws = new WebSocket(opts.signalingUrl);
  let pc: RTCPeerConnection | null = null;
  const onAbort = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    try {
      pc?.close();
    } catch {
      /* ignore */
    }
  };
  if (opts.signal) {
    if (opts.signal.aborted) {
      onAbort();
      throw new DOMException("Aborted", "AbortError");
    }
    opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  await waitForOpen(ws);
  if (opts.signal?.aborted) {
    onAbort();
    throw new DOMException("Aborted", "AbortError");
  }

  pc = new RTCPeerConnection(rtcConfig);
  const pendingRemoteIce: (RTCIceCandidateInit | null)[] = [];
  let remoteDescriptionSet = false;

  const send = (msg: ClientRelayMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  pc.onicecandidate = (ev) => {
    const c = ev.candidate;
    send({
      type: "ice",
      candidate: c ? c.toJSON() : null,
    });
  };

  const role = await new Promise<P2pRole>((resolve, reject) => {
    const onMetaWrapped: EventListener = (ev) => {
      const me = ev as MessageEvent;
      const parsed = parseSignalingWireMessage(JSON.parse(String(me.data)));
      if (parsed?.type !== "signal-meta") return;
      if ("waiting" in parsed && parsed.waiting) return;
      if ("role" in parsed) {
        ws.removeEventListener("message", onMetaWrapped);
        resolve(parsed.role);
      }
    };
    ws.addEventListener("message", onMetaWrapped);
    ws.addEventListener("close", () => reject(new Error("signaling closed before role")), {
      once: true,
    });
  });

  let resolveAnswererOffer!: () => void;
  const answererOfferReceived = new Promise<void>((r) => {
    resolveAnswererOffer = r;
  });

  const relayListener = async (ev: MessageEvent) => {
    let parsed: SignalingWireMessage | null = null;
    try {
      parsed = parseSignalingWireMessage(JSON.parse(String(ev.data)));
    } catch {
      return;
    }
    if (!parsed || parsed.type === "signal-meta") return;

    if (parsed.type === "ice") {
      if (!remoteDescriptionSet) {
        pendingRemoteIce.push(parsed.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(parsed.candidate ?? null);
      } catch {
        /* ignore */
      }
      return;
    }

    if (parsed.type === "answer") {
      if (role !== "offerer") return;
      if (pc.signalingState === "stable" && pc.remoteDescription != null) return;
      await pc.setRemoteDescription({ type: "answer", sdp: parsed.sdp });
      remoteDescriptionSet = true;
      await flushIce(pc, pendingRemoteIce);
      return;
    }

    if (parsed.type === "offer") {
      if (role !== "answerer") return;
      if (pc.remoteDescription != null) return;
      await pc.setRemoteDescription({ type: "offer", sdp: parsed.sdp });
      remoteDescriptionSet = true;
      await flushIce(pc, pendingRemoteIce);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", sdp: answer.sdp ?? "" });
      resolveAnswererOffer();
    }
  };

  const relayWrapped: EventListener = (ev) => {
    void relayListener(ev as MessageEvent);
  };

  const detachRelay = () => {
    ws.removeEventListener("message", relayWrapped);
  };

  let abortListenerArmed = !!opts.signal;
  const disarmAbort = () => {
    if (!abortListenerArmed) return;
    abortListenerArmed = false;
    opts.signal?.removeEventListener("abort", onAbort);
  };

  const closeAll = () => {
    disarmAbort();
    detachRelay();
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    try {
      pc?.close();
    } catch {
      /* ignore */
    }
  };

  ws.addEventListener("message", relayWrapped);

  if (role === "offerer") {
    const channel = pc.createDataChannel(label, opts.channelOptions ?? { ordered: true });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", sdp: offer.sdp ?? "" });
    await waitDataChannelOpen(channel);
    disarmAbort();
    return { pc, channel, role, close: closeAll };
  }

  const channelPromise = new Promise<RTCDataChannel>((resolve, reject) => {
    pc!.ondatachannel = (e) => {
      if (e.channel.label === label) resolve(e.channel);
      else reject(new Error("Unexpected RTCDataChannel label"));
    };
  });

  await answererOfferReceived;
  const channel = await channelPromise;
  await waitDataChannelOpen(channel);

  disarmAbort();
  return { pc: pc!, channel, role, close: closeAll };
}
