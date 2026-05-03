import {
  LEVELS,
  applyHit,
  applyMiss,
  clampLevel,
  levelById,
  levelSteadyPause,
  levelWindowMs,
  nextSignal,
  readBest,
  readUnlocked,
  recordBest,
  startRun,
  unlockNext,
  type LevelDef,
  type RunState,
  type SignalKind,
  type StorageLike,
} from "./panic-logic";

document.addEventListener("DOMContentLoaded", () => {
  const tap = document.getElementById("tap") as HTMLButtonElement | null;
  const padLabel = document.getElementById("padLabel") as HTMLElement | null;
  const overlay = document.getElementById("overlay") as HTMLElement | null;
  const overlayMsg = document.getElementById("overlayMsg") as HTMLElement | null;
  const overlayHint = document.getElementById("overlayHint") as HTMLElement | null;
  const overlayEyebrow = document.getElementById("overlayEyebrow") as HTMLElement | null;
  const overlayPrimary = document.getElementById("overlayPrimaryBtn") as HTMLButtonElement | null;
  const overlaySecondary = document.getElementById("overlaySecondaryBtn") as HTMLButtonElement | null;
  const levelSelect = document.getElementById("levelSelect") as HTMLElement | null;
  const levelGrid = document.getElementById("levelGrid") as HTMLElement | null;
  const statusEl = document.getElementById("status") as HTMLElement | null;
  const modifierEl = document.getElementById("modifier") as HTMLElement | null;
  const hudLevel = document.getElementById("hudLevel");
  const hudHits = document.getElementById("hudHits");
  const hudCombo = document.getElementById("hudCombo");
  const hudScore = document.getElementById("hudScore");
  const hudFails = document.getElementById("hudFails");
  if (
    !tap || !padLabel || !overlay || !overlayMsg || !overlayHint || !overlayEyebrow ||
    !overlayPrimary || !overlaySecondary || !levelSelect || !levelGrid || !statusEl ||
    !modifierEl || !hudLevel || !hudHits || !hudCombo || !hudScore || !hudFails
  ) return;

  const STORAGE: StorageLike = (() => {
    try {
      return window.localStorage;
    } catch {
      const map = new Map<string, string>();
      return {
        getItem: (k) => (map.has(k) ? map.get(k)! : null),
        setItem: (k, v) => {
          map.set(k, v);
        },
      };
    }
  })();

  let unlocked = clampLevel(readUnlocked(STORAGE));
  let currentLevel: LevelDef = levelById(1)!;
  let run: RunState = startRun(1);
  let signal: SignalKind = "green";
  let deadline = 0;
  let twinTapsRemaining = 0;
  let timers: number[] = [];
  let phase: "select" | "running" | "complete" | "failed" = "select";

  const rng = () => Math.random();

  function applyTheme(level: LevelDef): void {
    document.documentElement.style.setProperty("--pad-go", level.palette.go);
    document.documentElement.style.setProperty("--pad-trap", level.palette.trap);
    document.documentElement.style.setProperty("--accent", level.palette.go);
  }

  function clearTimers(): void {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function setPad(state: "waiting" | "go" | "trap" | "dark" | "yellow", label: string): void {
    tap!.classList.remove("waiting", "go", "trap", "dark", "yellow");
    tap!.classList.add(state);
    padLabel!.textContent = label;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLevelGrid(): void {
    const best = readBest(STORAGE);
    levelGrid!.innerHTML = LEVELS.map((lv) => {
      const isLocked = lv.id > unlocked;
      const cleared = (best[lv.id] ?? 0) > 0 && lv.id < unlocked;
      const classes = ["shLevelCard"];
      if (lv.id === currentLevel.id) classes.push("shLevelCard--current");
      if (cleared) classes.push("shLevelCard--cleared");
      const meta = isLocked ? "Locked" : `${lv.goalHits} clean greens`;
      const disabled = isLocked ? "disabled" : "";
      return `
        <button type="button" class="${classes.join(" ")}" data-level="${lv.id}" ${disabled} aria-label="Level ${lv.id} ${lv.name}">
          <span class="shLevelCardId">Lv ${lv.id}</span>
          <span class="shLevelCardName">${escapeHtml(lv.name)}</span>
          <span class="shLevelCardMeta">${meta}</span>
        </button>
      `;
    }).join("");
    for (const btn of levelGrid!.querySelectorAll<HTMLButtonElement>("button[data-level]")) {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-level"));
        if (Number.isFinite(id)) startLevel(id);
      });
    }
  }

  function showOverlay(opts: {
    eyebrow: string;
    message: string;
    hint: string;
    showLevelSelect: boolean;
    primary: string;
    secondary: string | null;
  }): void {
    overlay!.hidden = false;
    overlayEyebrow!.textContent = opts.eyebrow;
    overlayMsg!.textContent = opts.message;
    overlayHint!.textContent = opts.hint;
    levelSelect!.hidden = !opts.showLevelSelect;
    overlayPrimary!.textContent = opts.primary;
    overlayPrimary!.hidden = false;
    if (opts.secondary) {
      overlaySecondary!.textContent = opts.secondary;
      overlaySecondary!.hidden = false;
    } else {
      overlaySecondary!.hidden = true;
    }
  }

  function hideOverlay(): void {
    overlay!.hidden = true;
  }

  function showLevelSelect(): void {
    phase = "select";
    clearTimers();
    setPad("waiting", "PICK A LEVEL");
    statusEl!.textContent = "Pick a level — green is the goal";
    modifierEl!.textContent = "";
    renderLevelGrid();
    showOverlay({
      eyebrow: "Panic Button",
      message: "Pick a level",
      hint: `Cleared up to ${unlocked}/${LEVELS.length}.`,
      showLevelSelect: true,
      primary: `Continue (Lv ${unlocked})`,
      secondary: null,
    });
  }

  function updateHud(): void {
    hudLevel!.textContent = String(currentLevel.id);
    hudHits!.textContent = `${run.hits}/${run.goal}`;
    hudCombo!.textContent = String(run.combo);
    hudScore!.textContent = String(run.score);
    hudFails!.textContent = `${run.fails}/${run.failBudget}`;
  }

  function startLevel(id: number): void {
    const def = levelById(clampLevel(id));
    if (!def) return;
    if (def.id > unlocked) return;
    currentLevel = def;
    applyTheme(def);
    run = startRun(def.id);
    phase = "running";
    twinTapsRemaining = 0;
    statusEl!.textContent = def.briefing;
    modifierEl!.textContent = `Modifier: ${def.modifier === "none" ? "—" : def.modifier}`;
    hideOverlay();
    updateHud();
    nextWave();
  }

  function failLevel(reason: string): void {
    if (phase !== "running") return;
    phase = "failed";
    clearTimers();
    recordBest(STORAGE, currentLevel.id, run.score);
    setPad("trap", reason);
    showOverlay({
      eyebrow: "Failed",
      message: `${currentLevel.name} — ${run.score} pts`,
      hint: reason,
      showLevelSelect: false,
      primary: "Retry",
      secondary: "Levels",
    });
  }

  function clearLevel(): void {
    if (phase !== "running") return;
    phase = "complete";
    clearTimers();
    recordBest(STORAGE, currentLevel.id, run.score);
    unlocked = unlockNext(STORAGE, currentLevel.id);
    setPad("go", "CLEARED");
    const isFinal = currentLevel.id === LEVELS.length;
    showOverlay({
      eyebrow: isFinal ? "Campaign cleared" : "Level cleared",
      message: `${currentLevel.name} — ${run.score} pts`,
      hint: isFinal
        ? "Pick any level to chase a perfect run."
        : `Next: ${levelById(currentLevel.id + 1)?.name ?? ""}.`,
      showLevelSelect: false,
      primary: isFinal ? "Levels" : "Next level",
      secondary: "Levels",
    });
  }

  function flashWaitThenSignal(): void {
    if (phase !== "running") return;
    clearTimers();
    setPad("waiting", "steady…");

    const pause = levelSteadyPause(currentLevel, rng);
    const t0 = window.setTimeout(() => emitSignal(), pause);
    timers.push(t0);
  }

  function emitSignal(): void {
    if (phase !== "running") return;
    signal = nextSignal(currentLevel, run.combo, run.hits, rng);

    if (signal === "blackout") {
      setPad("dark", "");
      const t1 = window.setTimeout(() => {
        // After the blackout, force a green so the player has a chance.
        signal = "green";
        showGreen();
      }, 320 + rng() * 220);
      timers.push(t1);
      return;
    }

    if (signal === "doubleRed") {
      showRed();
      const t1 = window.setTimeout(() => {
        if (phase !== "running") return;
        showRed();
      }, 200 + rng() * 180);
      timers.push(t1);
      return;
    }

    if (signal === "red") {
      showRed();
      return;
    }

    if (currentLevel.modifier === "fakeFlash" && rng() < 0.35) {
      // brief red feint, then real green
      setPad("trap", "RED — freeze!");
      const t1 = window.setTimeout(() => {
        if (phase !== "running") return;
        signal = currentLevel.modifier === "bonusYellow" && rng() < 0.2 ? "yellow" : "green";
        if (signal === "yellow") showYellow();
        else showGreen();
      }, 220 + rng() * 200);
      timers.push(t1);
      return;
    }

    if (signal === "yellow") {
      showYellow();
      return;
    }

    showGreen();
  }

  function showGreen(): void {
    if (phase !== "running") return;
    const win = levelWindowMs(currentLevel, run.combo, run.hits);
    deadline = performance.now() + win;
    setPad("go", "GREEN — smash!");
    const tip = window.setTimeout(() => {
      if (phase !== "running") return;
      run = applyMiss(run, currentLevel, "late");
      updateHud();
      if (run.failed) {
        failLevel("Late tap — out of slack.");
        return;
      }
      nextWave();
    }, win);
    timers.push(tip);
  }

  function showYellow(): void {
    if (phase !== "running") return;
    const win = levelWindowMs(currentLevel, run.combo, run.hits) + 60;
    deadline = performance.now() + win;
    setPad("yellow", "YELLOW — bonus!");
    const tip = window.setTimeout(() => {
      if (phase !== "running") return;
      run = applyMiss(run, currentLevel, "late");
      updateHud();
      if (run.failed) {
        failLevel("Late tap — out of slack.");
        return;
      }
      nextWave();
    }, win);
    timers.push(tip);
  }

  function showRed(): void {
    if (phase !== "running") return;
    setPad("trap", "RED — freeze!");
    const tt = window.setTimeout(() => nextWave(), 480);
    timers.push(tt);
  }

  function nextWave(): void {
    if (phase !== "running") return;
    flashWaitThenSignal();
  }

  function handleTap(): void {
    if (phase !== "running") {
      handleOverlayPrimary();
      return;
    }
    const cls = tap!.classList;
    if (cls.contains("waiting")) return;
    if (cls.contains("dark")) {
      run = applyMiss(run, currentLevel, "red");
      updateHud();
      if (run.failed) failLevel("Tapped during blackout.");
      return;
    }
    if (cls.contains("trap")) {
      run = applyMiss(run, currentLevel, "red");
      updateHud();
      if (run.failed) {
        failLevel("Tapped a red — game over.");
        return;
      }
      clearTimers();
      const t1 = window.setTimeout(() => nextWave(), 320);
      timers.push(t1);
      return;
    }
    // green or yellow
    const now = performance.now();
    if (now > deadline) return;
    const isYellow = cls.contains("yellow");
    const sig: SignalKind = isYellow ? "yellow" : "green";

    // Twin Taps modifier — random green requires two clean presses.
    if (currentLevel.modifier === "twinTaps" && !isYellow) {
      if (twinTapsRemaining > 0) {
        twinTapsRemaining -= 1;
        if (twinTapsRemaining === 0) {
          run = applyHit(run, sig, currentLevel);
          updateHud();
          if (run.cleared) {
            clearLevel();
            return;
          }
          clearTimers();
          nextWave();
        } else {
          padLabel!.textContent = "AGAIN!";
        }
        return;
      }
      // Roll whether THIS green needs two taps.
      if (Math.random() < 0.35) {
        twinTapsRemaining = 1;
        padLabel!.textContent = "AGAIN!";
        return;
      }
    }

    run = applyHit(run, sig, currentLevel);
    updateHud();
    if (run.cleared) {
      clearLevel();
      return;
    }
    clearTimers();
    nextWave();
  }

  function handleOverlayPrimary(): void {
    if (phase === "select") {
      startLevel(unlocked);
      return;
    }
    if (phase === "complete") {
      if (currentLevel.id < LEVELS.length) startLevel(currentLevel.id + 1);
      else showLevelSelect();
      return;
    }
    if (phase === "failed") {
      startLevel(currentLevel.id);
      return;
    }
  }

  function handleOverlaySecondary(): void {
    showLevelSelect();
  }

  tap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleTap();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (phase === "running") handleTap();
      else handleOverlayPrimary();
    } else if (e.key === "Escape") {
      e.preventDefault();
      showLevelSelect();
    }
  });

  overlayPrimary.addEventListener("click", handleOverlayPrimary);
  overlaySecondary.addEventListener("click", handleOverlaySecondary);

  applyTheme(currentLevel);
  showLevelSelect();

  interface PanicTestApi {
    start(level?: number): void;
    cleanGreens(n?: number): { score: number; cleared: boolean };
    state(): { level: number; hits: number; goal: number; cleared: boolean; failed: boolean };
  }

  (window as unknown as { __panicTest?: PanicTestApi }).__panicTest = {
    start(level = 1) {
      unlocked = clampLevel(Math.max(unlocked, level));
      startLevel(level);
    },
    cleanGreens(n = 1) {
      for (let i = 0; i < n; i++) {
        if (run.cleared || run.failed) break;
        run = applyHit(run, "green", currentLevel);
      }
      updateHud();
      if (run.cleared) clearLevel();
      return { score: run.score, cleared: run.cleared };
    },
    state() {
      return {
        level: currentLevel.id,
        hits: run.hits,
        goal: run.goal,
        cleared: run.cleared,
        failed: run.failed,
      };
    },
  };
});
