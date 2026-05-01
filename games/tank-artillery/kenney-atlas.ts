/**
 * Kenney „Tanks“ — Retina-Bogen `tanks_spritesheetRetina.png` (1024×2048).
 *
 * WICHTIG: Die Kachelpositionen **weichen vom** `tanks_spritesheetDefault.xml` ab —
 * Retina ist **nicht** schlicht 2× dieselben (x,y)-Werte wie `sprites.png`.
 * Die Rechtecke wurden an der echten PNG vermessen (gleiche Kachelbreite ~172 px).
 */
export const SPRITESHEET_REL = `${import.meta.env.BASE_URL}games/tank-artillery/kenney/tanks_spritesheetRetina.png`;

export const ATLAS = {
  /** Erste Kachel der grünen Farbreihe — **Spieler** */
  tankPlayerGreen: { x: 0, y: 1138, w: 172, h: 128 },
  /** Zweite Kachel derselben Reihe — Gegner mit Skin „green“ */
  tankGreenEnemy: { x: 172, y: 1138, w: 172, h: 128 },
  /** Marine-Reihe — mitte oben liegt ein Artefakt (Streifen + transparenter Spalt) vor dem Turm → obersten 10 Quell‑px abschneiden */
  tankNavy: { x: 0, y: 278, w: 172, h: 118 },
  /** Graue / Silber-Reihe — wie Navy/Desert liegt oben Artefakt (dünner Strich vor Turm): oberste 10 Quell‑px weg */
  tankGrey: { x: 0, y: 856, w: 172, h: 118 },
  /** Wüsten-/Sand-Panzer (gleiche Reihenlage wie Marine). Kein y≈548 (UI-Pfeile). Oberen Artefakt wie bei Navy abstreifen */
  tankDesert: { x: 0, y: 138, w: 172, h: 118 },
  /** Geschoss in der Luft (`tank_bulletFly3` liegt auf dieser Bogenlage) */
  bulletFly3: { x: 0, y: 824, w: 180, h: 52 },
} as const;
