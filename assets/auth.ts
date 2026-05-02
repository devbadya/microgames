/**
 * Local-only authentication for the Microgames front-end.
 *
 * Threat model: this is a static site with no backend, so any "account"
 * lives in the user's own browser. The goal is therefore not server-side
 * confidentiality, but:
 *   - Passwords are never stored as plain text. They go through PBKDF2-SHA256
 *     with a per-user random salt, so a casual attacker who reads localStorage
 *     cannot recover the password.
 *   - All sensitive comparisons use a constant-time helper, removing trivial
 *     timing oracles from a determined local attacker (or from a script that
 *     leaks via a side channel).
 *   - Login rate-limiting (lockout after repeated failures) blunts brute-force
 *     attempts from another tab.
 *   - Sessions are random 256-bit tokens with a hard expiry; logging out
 *     fully revokes them.
 *
 * The module is intentionally framework-free and dependency-injectable so it
 * can be exercised in unit tests with deterministic clocks/storage.
 */

const USERS_KEY = "microgames.auth.users.v1";
const SESSION_KEY = "microgames.auth.session.v1";
const ATTEMPTS_KEY = "microgames.auth.attempts.v1";

/** OWASP-recommended PBKDF2-SHA256 iteration count (2023 baseline). */
export const DEFAULT_PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_LOCKOUT_THRESHOLD = 5;
const DEFAULT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{1,30}[a-zA-Z0-9])?$/;
const EMAIL_RE =
  /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export type StoredUser = {
  username: string;
  email: string;
  saltHex: string;
  hashHex: string;
  iterations: number;
  createdAt: number;
};

export type Session = {
  token: string;
  username: string;
  expiresAt: number;
};

type AttemptRecord = {
  count: number;
  lockedUntil: number | null;
};

type AttemptsMap = Record<string, AttemptRecord>;

export type ValidationError =
  | "username_required"
  | "username_invalid"
  | "username_taken"
  | "email_invalid"
  | "password_too_short"
  | "password_weak"
  | "password_mismatch";

export type LoginError =
  | "credentials_invalid"
  | "account_locked"
  | "username_required"
  | "password_required";

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type AuthDependencies = {
  storage: Storage;
  crypto: Crypto;
  now: () => number;
  iterations: number;
  sessionTtlMs: number;
  lockoutThreshold: number;
  lockoutWindowMs: number;
};

export type AuthOptions = Partial<AuthDependencies>;

function defaultDependencies(opts: AuthOptions): AuthDependencies {
  return {
    storage: opts.storage ?? globalThis.localStorage,
    crypto: opts.crypto ?? globalThis.crypto,
    now: opts.now ?? (() => Date.now()),
    iterations: opts.iterations ?? DEFAULT_PBKDF2_ITERATIONS,
    sessionTtlMs: opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
    lockoutThreshold: opts.lockoutThreshold ?? DEFAULT_LOCKOUT_THRESHOLD,
    lockoutWindowMs: opts.lockoutWindowMs ?? DEFAULT_LOCKOUT_WINDOW_MS,
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex length must be even");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

/**
 * Constant-time string comparison. Both values are normalised to the same
 * length so that an attacker can't infer where a divergence happened from
 * timing alone.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "very_weak" | "weak" | "fair" | "strong" | "excellent";
};

/** Heuristic strength meter. Used purely for UI feedback, not gating. */
export function evaluatePasswordStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes >= 3) score++;
  if (classes === 4) score++;
  const final = Math.max(0, Math.min(4, score)) as PasswordStrength["score"];
  const label: PasswordStrength["label"] =
    final === 0
      ? "very_weak"
      : final === 1
        ? "weak"
        : final === 2
          ? "fair"
          : final === 3
            ? "strong"
            : "excellent";
  return { score: final, label };
}

export function validateUsername(raw: string): ValidationError | null {
  const v = raw.trim();
  if (!v) return "username_required";
  if (!USERNAME_RE.test(v)) return "username_invalid";
  return null;
}

export function validateEmail(raw: string): ValidationError | null {
  const v = raw.trim();
  if (!EMAIL_RE.test(v) || v.length > 254) return "email_invalid";
  return null;
}

export function validatePassword(raw: string): ValidationError | null {
  if (raw.length < 10) return "password_too_short";
  const { score } = evaluatePasswordStrength(raw);
  if (score < 2) return "password_weak";
  return null;
}

function loadUsers(storage: Storage): Record<string, StoredUser> {
  try {
    const raw = storage.getItem(USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, StoredUser>;
    }
  } catch {
    /* corrupted store — drop it */
  }
  return {};
}

function saveUsers(storage: Storage, users: Record<string, StoredUser>): void {
  try {
    storage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* quota or privacy mode — best-effort */
  }
}

function loadSession(storage: Storage): Session | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      parsed &&
      typeof parsed.token === "string" &&
      typeof parsed.username === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      return {
        token: parsed.token,
        username: parsed.username,
        expiresAt: parsed.expiresAt,
      };
    }
  } catch {
    /* corrupted store */
  }
  return null;
}

function saveSession(storage: Storage, session: Session | null): void {
  try {
    if (session) storage.setItem(SESSION_KEY, JSON.stringify(session));
    else storage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function loadAttempts(storage: Storage): AttemptsMap {
  try {
    const raw = storage.getItem(ATTEMPTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AttemptsMap;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveAttempts(storage: Storage, attempts: AttemptsMap): void {
  try {
    storage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    /* ignore */
  }
}

function userKey(username: string): string {
  return username.trim().toLowerCase();
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  // Detach a clean ArrayBuffer copy so SubtleCrypto sees a plain BufferSource
  // even when the underlying buffer is a SharedArrayBuffer slice in some envs.
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

async function deriveHash(
  cryptoImpl: Crypto,
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const passwordBuf = toArrayBuffer(passwordBytes);
  const saltBuf = toArrayBuffer(hexToBytes(saltHex));
  const baseKey = await cryptoImpl.subtle.importKey(
    "raw",
    passwordBuf,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await cryptoImpl.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    KEY_BYTES * 8,
  );
  passwordBytes.fill(0);
  return bytesToHex(new Uint8Array(bits));
}

function randomHex(cryptoImpl: Crypto, byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  cryptoImpl.getRandomValues(buf);
  return bytesToHex(buf);
}

export type RegisterResult =
  | { ok: true; session: Session }
  | { ok: false; errors: ValidationError[] };

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; error: LoginError; lockedUntil?: number };

export class AuthService {
  private readonly deps: AuthDependencies;

  constructor(opts: AuthOptions = {}) {
    this.deps = defaultDependencies(opts);
  }

  hasAccounts(): boolean {
    const users = loadUsers(this.deps.storage);
    return Object.keys(users).length > 0;
  }

  countAccounts(): number {
    return Object.keys(loadUsers(this.deps.storage)).length;
  }

  getActiveSession(): Session | null {
    const s = loadSession(this.deps.storage);
    if (!s) return null;
    if (s.expiresAt <= this.deps.now()) {
      saveSession(this.deps.storage, null);
      return null;
    }
    const users = loadUsers(this.deps.storage);
    if (!users[userKey(s.username)]) {
      saveSession(this.deps.storage, null);
      return null;
    }
    return s;
  }

  getActiveUser(): StoredUser | null {
    const session = this.getActiveSession();
    if (!session) return null;
    const users = loadUsers(this.deps.storage);
    return users[userKey(session.username)] ?? null;
  }

  validateRegistration(input: RegisterInput): ValidationError[] {
    const errors: ValidationError[] = [];

    const userErr = validateUsername(input.username);
    if (userErr) errors.push(userErr);

    const emailErr = validateEmail(input.email);
    if (emailErr) errors.push(emailErr);

    const pwErr = validatePassword(input.password);
    if (pwErr) errors.push(pwErr);

    if (input.password !== input.confirmPassword) {
      errors.push("password_mismatch");
    }

    if (!userErr) {
      const users = loadUsers(this.deps.storage);
      if (users[userKey(input.username)]) errors.push("username_taken");
    }

    return errors;
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const errors = this.validateRegistration(input);
    if (errors.length) return { ok: false, errors };

    const username = input.username.trim();
    const saltHex = randomHex(this.deps.crypto, SALT_BYTES);
    const hashHex = await deriveHash(
      this.deps.crypto,
      input.password,
      saltHex,
      this.deps.iterations,
    );

    const user: StoredUser = {
      username,
      email: input.email.trim().toLowerCase(),
      saltHex,
      hashHex,
      iterations: this.deps.iterations,
      createdAt: this.deps.now(),
    };

    const users = loadUsers(this.deps.storage);
    users[userKey(username)] = user;
    saveUsers(this.deps.storage, users);

    const session = this.createSession(username);
    saveSession(this.deps.storage, session);
    this.clearAttempts(username);
    return { ok: true, session };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    if (!input.username.trim()) {
      return { ok: false, error: "username_required" };
    }
    if (!input.password) {
      return { ok: false, error: "password_required" };
    }

    const key = userKey(input.username);
    const lockedUntil = this.lockedUntil(key);
    if (lockedUntil && lockedUntil > this.deps.now()) {
      return { ok: false, error: "account_locked", lockedUntil };
    }

    const users = loadUsers(this.deps.storage);
    const user = users[key];

    // Always run a hash so timing for "user not found" matches "user found".
    const dummySalt = "0".repeat(SALT_BYTES * 2);
    const candidateHash = await deriveHash(
      this.deps.crypto,
      input.password,
      user?.saltHex ?? dummySalt,
      user?.iterations ?? this.deps.iterations,
    );

    if (!user || !timingSafeEqual(candidateHash, user.hashHex)) {
      const lockResult = this.recordFailure(key);
      if (lockResult.locked) {
        return {
          ok: false,
          error: "account_locked",
          lockedUntil: lockResult.lockedUntil ?? undefined,
        };
      }
      return { ok: false, error: "credentials_invalid" };
    }

    this.clearAttempts(key);
    const session = this.createSession(user.username);
    saveSession(this.deps.storage, session);
    return { ok: true, session };
  }

  logout(): void {
    saveSession(this.deps.storage, null);
  }

  /** Test/debug helper — wipes everything stored by this module. */
  reset(): void {
    try {
      this.deps.storage.removeItem(USERS_KEY);
      this.deps.storage.removeItem(SESSION_KEY);
      this.deps.storage.removeItem(ATTEMPTS_KEY);
    } catch {
      /* ignore */
    }
  }

  private createSession(username: string): Session {
    return {
      token: randomHex(this.deps.crypto, SESSION_TOKEN_BYTES),
      username,
      expiresAt: this.deps.now() + this.deps.sessionTtlMs,
    };
  }

  private lockedUntil(key: string): number | null {
    const attempts = loadAttempts(this.deps.storage);
    const r = attempts[key];
    if (!r || !r.lockedUntil) return null;
    if (r.lockedUntil <= this.deps.now()) {
      delete attempts[key];
      saveAttempts(this.deps.storage, attempts);
      return null;
    }
    return r.lockedUntil;
  }

  private recordFailure(key: string): { locked: boolean; lockedUntil: number | null } {
    const attempts = loadAttempts(this.deps.storage);
    const current = attempts[key] ?? { count: 0, lockedUntil: null };
    const next: AttemptRecord = { count: current.count + 1, lockedUntil: null };
    if (next.count >= this.deps.lockoutThreshold) {
      next.lockedUntil = this.deps.now() + this.deps.lockoutWindowMs;
    }
    attempts[key] = next;
    saveAttempts(this.deps.storage, attempts);
    return { locked: !!next.lockedUntil, lockedUntil: next.lockedUntil };
  }

  private clearAttempts(key: string): void {
    const attempts = loadAttempts(this.deps.storage);
    if (attempts[key]) {
      delete attempts[key];
      saveAttempts(this.deps.storage, attempts);
    }
  }
}
