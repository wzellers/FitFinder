import { colorMap } from '@/lib/constants';

function hexOf(color: string): string {
  return (colorMap[color] || color).replace('#', '');
}

/** WCAG relative luminance of a palette colour name or hex. */
function luminance(color: string): number {
  const hex = hexOf(color);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0;
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The app's neutral ink: text, and the accent when there's no outfit. */
export const NEUTRAL_INK = '#1c1917';
const INK = NEUTRAL_INK;
const PAPER = '#ffffff';

/** Whichever of dark ink or white reads better on `bg`. */
function readableOn(bg: string): string {
  return contrast(INK, bg) >= contrast(PAPER, bg) ? INK : PAPER;
}

/** Mix `color` toward `toward` by `amount` (0 = color, 1 = toward), as hex. */
export function mix(color: string, toward: string, amount: number): string {
  const a = hexOf(color);
  const b = hexOf(toward);
  const out = [0, 2, 4].map((i) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${out.join('')}`;
}

/** `color`, darkened just enough to reach `ratio` against `bg`. */
function deepen(color: string, bg: string, ratio: number): string {
  for (let k = 0; k <= 20; k++) {
    const c = mix(color, '#000000', k * 0.05);
    if (contrast(c, bg) >= ratio) return c;
  }
  return INK;
}

export interface OutfitTheme {
  /** Poster header background: the top's colour. */
  posterBg: string;
  /** Huge poster title (large text: needs 3:1): the bottom's colour if it reads. */
  posterTitle: string;
  /** Readout, script and buttons on the poster (needs 4.5:1). */
  posterFg: string;
  /** Decorative cutout shape: the shoes' colour if it shows. */
  cutout: string;
  /** Primary button / selected toggle on the poster, and its label. */
  accent: string;
  accentInk: string;
  /** Nav highlight and its label. */
  pillActive: string;
  pillActiveInk: string;
  /** The outfit's top, bottom and shoes colours, for the page's colour wash. */
  top: string;
  bottom: string;
  shoes: string;
  /** The accent for buttons, links and selected states on white: the top's
   * colour, deepened if needed to read as text on white (4.5:1). */
  uiAccent: string;
  uiAccentInk: string;
  /** A pale tint of the accent, for soft fills. */
  uiTint: string;
  /** The rating glow: the top's colour, deepened if too pale to see on white. */
  glow: string;
}

/**
 * Build a theme from an outfit's colours: the top is the main colour, the
 * bottom the secondary and the shoes the third. Every pairing stays
 * readable; a colour that clashes falls back to readable ink.
 */
export function themeFromOutfit(top: string, bottom: string, shoes?: string | null): OutfitTheme {
  const T = `#${hexOf(top)}`;
  const B = `#${hexOf(bottom)}`;
  const S = shoes ? `#${hexOf(shoes)}` : B;
  const posterBg = T;
  const posterFg = readableOn(posterBg);
  const posterTitle = contrast(B, posterBg) >= 3 ? B : posterFg;
  const cutout = contrast(S, posterBg) >= 1.5 ? S : contrast(B, posterBg) >= 1.5 ? B : posterFg;
  const accent = contrast(posterTitle, posterBg) >= 3 ? posterTitle : posterFg;
  // The nav highlight sits on a white pill, so it needs to stand out from white.
  const pillActive = [T, B, S].find((c) => contrast(c, PAPER) >= 1.6) ?? NEUTRAL_INK;
  const uiAccent = deepen(T, PAPER, 4.5);
  const uiTint = mix(uiAccent, PAPER, 0.88);
  return {
    posterBg,
    posterTitle,
    posterFg,
    cutout,
    accent,
    accentInk: readableOn(accent),
    pillActive,
    pillActiveInk: readableOn(pillActive),
    top: T,
    bottom: B,
    shoes: S,
    uiAccent,
    uiAccentInk: readableOn(uiAccent),
    uiTint,
    glow: contrast(T, PAPER) >= 1.4 ? T : deepen(T, PAPER, 1.4),
  };
}

/** The theme from just a top and bottom (the shoes take the bottom's colour). */
export function themeFromPairing(top: string, bottom: string): OutfitTheme {
  return themeFromOutfit(top, bottom);
}
