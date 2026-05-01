export function scoreForHit(combo: number): number {
  return 12 + Math.min(90, combo * 6);
}

export function windowMsForRound(combo: number): number {
  return Math.max(110, 420 - Math.min(24, combo) * 12);
}

export function decoyChance(combo: number): number {
  return Math.min(0.55, 0.22 + combo * 0.02);
}
