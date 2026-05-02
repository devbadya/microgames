/** @vitest-environment happy-dom */

import { describe, expect, test, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

import {
  AuthService,
  bytesToHex,
  hexToBytes,
  timingSafeEqual,
  evaluatePasswordStrength,
  validateUsername,
  validateEmail,
  validatePassword,
  type AuthOptions,
} from "./auth";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

function svc(extra: Partial<AuthOptions> = {}): {
  auth: AuthService;
  storage: MemoryStorage;
  setNow: (n: number) => void;
} {
  const storage = new MemoryStorage();
  let nowMs = 1_700_000_000_000;
  const auth = new AuthService({
    storage,
    crypto: webcrypto as unknown as Crypto,
    now: () => nowMs,
    iterations: 1, // keep tests fast — derivation logic is what we cover
    ...extra,
  });
  return {
    auth,
    storage,
    setNow: (n: number) => {
      nowMs = n;
    },
  };
}

describe("byte/hex helpers", () => {
  test("round trips hex <-> bytes", () => {
    const arr = new Uint8Array([0, 1, 15, 16, 254, 255]);
    expect(bytesToHex(arr)).toBe("00010f10feff");
    expect(Array.from(hexToBytes("00010f10feff"))).toEqual(Array.from(arr));
  });

  test("rejects odd-length hex", () => {
    expect(() => hexToBytes("abc")).toThrow();
  });
});

describe("timingSafeEqual", () => {
  test("matches identical strings and rejects different ones", () => {
    expect(timingSafeEqual("alpha", "alpha")).toBe(true);
    expect(timingSafeEqual("alpha", "alphb")).toBe(false);
    expect(timingSafeEqual("short", "longer")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("password strength + validators", () => {
  test("strength label scales with complexity", () => {
    expect(evaluatePasswordStrength("aaaa").label).toBe("very_weak");
    expect(evaluatePasswordStrength("Aa1aaaaaaaaaaa").label).toBe("strong");
    expect(evaluatePasswordStrength("Aa1!verylongpwd!").label).toBe("excellent");
  });

  test("username validator", () => {
    expect(validateUsername("")).toBe("username_required");
    expect(validateUsername("ab")).toBe("username_invalid");
    expect(validateUsername("_no")).toBe("username_invalid");
    expect(validateUsername("ok_name1")).toBeNull();
  });

  test("email validator", () => {
    expect(validateEmail("nope")).toBe("email_invalid");
    expect(validateEmail("a@b.c")).toBeNull();
  });

  test("password validator", () => {
    expect(validatePassword("short")).toBe("password_too_short");
    expect(validatePassword("alllowercase")).toBe("password_weak");
    expect(validatePassword("StrongPass1!")).toBeNull();
  });
});

describe("AuthService.register", () => {
  beforeEach(() => undefined);

  test("rejects mismatched and weak passwords", async () => {
    const { auth } = svc();
    const result = await auth.register({
      username: "alice",
      email: "a@b.co",
      password: "abcdefghij",
      confirmPassword: "different",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining(["password_weak", "password_mismatch"]),
      );
    }
  });

  test("registers a fresh account, signs the user in, and prevents duplicate username", async () => {
    const { auth } = svc();
    const first = await auth.register({
      username: "alice",
      email: "alice@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    expect(first.ok).toBe(true);
    expect(auth.getActiveSession()).not.toBeNull();
    expect(auth.getActiveUser()?.username).toBe("alice");

    const dup = await auth.register({
      username: "ALICE",
      email: "alice2@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.errors).toContain("username_taken");
  });
});

describe("AuthService.login", () => {
  test("logs in with correct credentials and rejects bad ones", async () => {
    const { auth } = svc();
    await auth.register({
      username: "bob",
      email: "bob@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    auth.logout();
    expect(auth.getActiveSession()).toBeNull();

    const ok = await auth.login({ username: "bob", password: "Sup3rSecret!" });
    expect(ok.ok).toBe(true);
    expect(auth.getActiveSession()).not.toBeNull();

    auth.logout();
    const bad = await auth.login({ username: "bob", password: "wrong" });
    expect(bad.ok).toBe(false);
  });

  test("requires username and password", async () => {
    const { auth } = svc();
    expect((await auth.login({ username: "", password: "x" })).ok).toBe(false);
    expect((await auth.login({ username: "x", password: "" })).ok).toBe(false);
  });

  test("locks the account after repeated failures", async () => {
    const { auth, setNow } = svc({ lockoutThreshold: 3, lockoutWindowMs: 1000 });
    await auth.register({
      username: "carol",
      email: "carol@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    auth.logout();

    for (let i = 0; i < 3; i++) {
      await auth.login({ username: "carol", password: "wrong" });
    }
    const locked = await auth.login({
      username: "carol",
      password: "Sup3rSecret!",
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe("account_locked");

    setNow(1_700_000_002_000);
    const after = await auth.login({
      username: "carol",
      password: "Sup3rSecret!",
    });
    expect(after.ok).toBe(true);
  });

  test("rejects login for unknown user without leaking via short-circuit", async () => {
    const { auth } = svc();
    const r = await auth.login({ username: "ghost", password: "anything" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("credentials_invalid");
  });
});

describe("AuthService session lifecycle", () => {
  test("session expires after TTL and is invalidated when user is removed", async () => {
    const { auth, storage, setNow } = svc({ sessionTtlMs: 100 });
    await auth.register({
      username: "dave",
      email: "dave@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });

    setNow(1_700_000_000_001);
    expect(auth.getActiveSession()).not.toBeNull();

    setNow(1_700_000_000_500);
    expect(auth.getActiveSession()).toBeNull();

    await auth.register({
      username: "eve",
      email: "eve@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    storage.removeItem("microgames.auth.users.v1");
    expect(auth.getActiveSession()).toBeNull();
  });

  test("hasAccounts reflects registered users and reset clears everything", async () => {
    const { auth } = svc();
    expect(auth.hasAccounts()).toBe(false);
    await auth.register({
      username: "frank",
      email: "frank@example.com",
      password: "Sup3rSecret!",
      confirmPassword: "Sup3rSecret!",
    });
    expect(auth.hasAccounts()).toBe(true);
    expect(auth.countAccounts()).toBe(1);
    auth.reset();
    expect(auth.hasAccounts()).toBe(false);
    expect(auth.getActiveSession()).toBeNull();
  });
});
