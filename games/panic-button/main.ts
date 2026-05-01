import { decoyChance, scoreForHit, windowMsForRound } from "./panic-logic";

document.addEventListener("DOMContentLoaded", () => {
  const tap = document.getElementById("tap") as HTMLButtonElement | null;
  const overlay = document.getElementById("overlay") as HTMLElement | null;
  const overlayMsg = document.getElementById("overlayMsg") as HTMLElement | null;
  const scoreEl = document.getElementById("score") as HTMLElement | null;
  const comboEl = document.getElementById("combo") as HTMLElement | null;
  const statusEl = document.getElementById("status") as HTMLElement | null;
  if (!tap || !overlay || !overlayMsg || !scoreEl || !comboEl || !statusEl) return;
  const btn = tap;
  const ov = overlay;
  const ovMsg = overlayMsg;
  const hudS = scoreEl;
  const hudC = comboEl;
  const st = statusEl;

  const rng = () => Math.random();

  let score = 0;
  let combo = 0;
  let running = false;
  let deadline = 0;
  let timers: number[] = [];

  function killTimers(): void {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function finalize(msg: string): void {
    killTimers();
    running = false;
    ov.hidden = false;
    ovMsg.textContent = msg;
    btn.classList.remove("go", "trap");
    btn.classList.add("waiting");
    btn.textContent = "Done — Space";
    st.textContent = "Space restarts round one";
  }

  function flashWaitThenSignal(): void {
    killTimers();
    btn.classList.remove("go", "trap");
    btn.classList.add("waiting");
    btn.textContent = "steady…";

    const pause = Math.floor(260 + rng() * 740);
    const t0 = window.setTimeout(() => {
      const okGreen = rng() >= decoyChance(combo);
      if (okGreen) {
        deadline = performance.now() + windowMsForRound(combo);
        btn.classList.remove("waiting");
        btn.classList.add("go");
        btn.textContent = "GREEN — smash!";
        const win = windowMsForRound(combo);
        const t1 = window.setTimeout(() => finalize(`Late — stopped at ${score} pts`), win);
        timers.push(t1);
      } else {
        btn.classList.remove("waiting");
        btn.classList.add("trap");
        btn.textContent = "RED — freeze!";
        const t2 = window.setTimeout(() => nextWave(), 500);
        timers.push(t2);
      }
    }, pause);
    timers.push(t0);
  }

  function nextWave(): void {
    if (!running) return;
    flashWaitThenSignal();
  }

  function boot(): void {
    killTimers();
    running = true;
    combo = 0;
    score = 0;
    hudS.textContent = "0";
    hudC.textContent = "0";
    ov.hidden = true;
    st.textContent = "Only hammer GREEN";
    nextWave();
  }

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!running) return;
    if (btn.textContent === "steady…") return;
    if (btn.classList.contains("trap")) {
      finalize(`Red buzzer — game over at ${score}`);
      combo = 0;
      return;
    }
    if (btn.classList.contains("go")) {
      const now = performance.now();
      if (now <= deadline) {
        killTimers();
        score += scoreForHit(combo);
        combo += 1;
        hudS.textContent = String(score);
        hudC.textContent = String(combo);
        st.textContent = "Synced!";
        nextWave();
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!running || ov.hidden === false) boot();
    }
  });

  btn.classList.add("waiting");
  btn.textContent = "Space to start";
  st.textContent = "Panic Button — reds are fake-outs";
});
