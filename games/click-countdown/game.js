const DURATION_MS = 10_000;
const TICK_MS = 25;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function main() {
  const timeEl = document.getElementById("time");
  const scoreEl = document.getElementById("score");
  const btn = document.getElementById("clickBtn");
  const hint = document.getElementById("hint");
  if (!timeEl || !scoreEl || !btn || !hint) return;

  let running = false;
  let startAt = 0;
  let score = 0;
  let timer = null;

  const setTime = (msLeft) => {
    timeEl.textContent = formatSeconds(msLeft);
  };

  const setScore = (n) => {
    scoreEl.textContent = String(n);
  };

  const end = () => {
    running = false;
    if (timer) window.clearInterval(timer);
    timer = null;
    btn.disabled = false;
    btn.textContent = "Play again";
    hint.textContent = "Nice. Try to beat your score.";
  };

  const tick = () => {
    const elapsed = Date.now() - startAt;
    const left = clamp(DURATION_MS - elapsed, 0, DURATION_MS);
    setTime(left);
    if (left <= 0) end();
  };

  const click = () => {
    if (!running) return;
    score += 1;
    setScore(score);
  };

  const start = () => {
    running = true;
    score = 0;
    setScore(score);
    startAt = Date.now();
    setTime(DURATION_MS);
    btn.disabled = true;
    btn.textContent = "Click!";
    hint.textContent = "Go go go!";
    timer = window.setInterval(tick, TICK_MS);
  };

  btn.addEventListener("click", start);
  btn.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") start();
  });

  window.addEventListener("keydown", (e) => {
    if (!running && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      start();
      return;
    }
    if (running && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      click();
    }
  });

  btn.addEventListener("pointerdown", () => {
    if (running) click();
  });

  setTime(DURATION_MS);
  setScore(0);
}

document.addEventListener("DOMContentLoaded", main);

