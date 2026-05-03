/**
 * Kenney „Tanks“ — Retina-Bogen `tanks_spritesheetRetina.png` (1024×2048).
 *
 * WICHTIG: Die Kachelpositionen **weichen vom** `tanks_spritesheetDefault.xml` ab —
 * Retina ist **nicht** schlicht 2× dieselben (x,y)-Werte wie `sprites.png`.
 * Die Rechtecke wurden an der echten PNG vermessen (gleiche Kachelbreite ~172 px).
 */
export const SPRITESHEET_REL = `${import.meta.env.BASE_URL}games/tank-artillery/kenney/tanks_spritesheetRetina.png`;

export type GeneratedTankSpriteKey = "redStriker" | "viperEnergy" | "bunkerShield";

export interface GeneratedTankFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeneratedTankSpriteDef {
  src: string;
  frameW: number;
  frameH: number;
  sourceBodyW: number;
  sourceBodyH: number;
  targetW: number;
  sourceFacesRight: boolean;
  frames: readonly GeneratedTankFrameRect[];
}

export const GENERATED_TANK_SPRITES: Record<GeneratedTankSpriteKey, GeneratedTankSpriteDef> = {
  redStriker: {
    src: `${import.meta.env.BASE_URL}games/tank-artillery/generated/tank-red-striker-animation-sheet.png`,
    frameW: 384,
    frameH: 1024,
    sourceBodyW: 269,
    sourceBodyH: 185,
    targetW: 112,
    sourceFacesRight: false,
    frames: [
      { x: 72, y: 448, w: 269, h: 185 },
      { x: 40, y: 407, w: 344, h: 226 },
      { x: 0, y: 456, w: 384, h: 178 },
      { x: 0, y: 453, w: 308, h: 183 },
    ],
  },
  viperEnergy: {
    src: `${import.meta.env.BASE_URL}games/tank-artillery/generated/tank-viper-energy-animation-sheet.png`,
    frameW: 384,
    frameH: 1024,
    sourceBodyW: 302,
    sourceBodyH: 158,
    targetW: 116,
    sourceFacesRight: true,
    frames: [
      { x: 30, y: 443, w: 302, h: 158 },
      { x: 18, y: 435, w: 366, h: 169 },
      { x: 0, y: 448, w: 328, h: 152 },
      { x: 35, y: 445, w: 324, h: 154 },
    ],
  },
  bunkerShield: {
    src: `${import.meta.env.BASE_URL}games/tank-artillery/generated/tank-bunker-shield-animation-sheet.png`,
    frameW: 384,
    frameH: 1024,
    sourceBodyW: 325,
    sourceBodyH: 231,
    targetW: 128,
    sourceFacesRight: true,
    frames: [
      { x: 34, y: 389, w: 325, h: 231 },
      { x: 28, y: 426, w: 356, h: 193 },
      { x: 0, y: 354, w: 384, h: 278 },
      { x: 0, y: 402, w: 375, h: 221 },
    ],
  },
};

export const ATLAS = {
  /** Grauer Sturm-Panzer mit rotem Keil — erste Kachel oben links */
  tankCrimson: { x: 0, y: 0, w: 184, h: 137 },
  /** Erste Kachel der grünen Farbreihe — **Spieler** */
  tankPlayerGreen: { x: 0, y: 1138, w: 172, h: 128 },
  /** Zweite Kachel derselben Reihe — Gegner mit Skin „green“ */
  tankGreenEnemy: { x: 172, y: 1138, w: 172, h: 128 },
  /** Marine-Reihe — mitte oben liegt ein Artefakt (Streifen + transparenter Spalt) vor dem Turm → obersten 10 Quell‑px abschneiden */
  tankNavy: { x: 0, y: 278, w: 172, h: 118 },
  /** Graue / Silber-Reihe — wie Navy/Desert liegt oben Artefakt (dünner Strich vor Turm): oberste 10 Quell‑px weg */
  tankGrey: { x: 0, y: 856, w: 172, h: 118 },
  /** Schweres dunkles Chassis aus der mittleren Atlas-Spalte */
  tankBunker: { x: 173, y: 856, w: 163, h: 134 },
  /** Wüsten-/Sand-Panzer (gleiche Reihenlage wie Marine). Kein y≈548 (UI-Pfeile). Oberen Artefakt wie bei Navy abstreifen */
  tankDesert: { x: 0, y: 138, w: 172, h: 118 },
  /** Kompakter grüner Schnellpanzer aus der unteren Atlas-Reihe */
  tankViper: { x: 167, y: 1840, w: 165, h: 96 },
  /** Geschoss in der Luft (`tank_bulletFly3` liegt auf dieser Bogenlage) */
  bulletFly3: { x: 0, y: 824, w: 180, h: 52 },
} as const;
