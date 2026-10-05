import { colorMap } from '@/lib/constants';

function hexOf(color: string): string {
  return (colorMap[color] || color).replace('#', '');
}

/** WCAG relative luminance of a palette colour name or hex. */
export function luminance(color: string): number {
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

const INK = '#2a0c12';
const PAPER = '#ffffff';

/** Whichever of dark ink or white reads better on `bg`. */
function readableOn(bg: string): string {
  return contrast(INK, bg) >= contrast(PAPER, bg) ? INK : PAPER;
}

export interface OutfitTheme {
  /** Poster header background. */
  posterBg: string;
  /** Huge poster title (large text: needs 3:1). */
  posterTitle: string;
  /** Readout, script and buttons on the poster (needs 4.5:1). */
  posterFg: string;
  /** Decorative cutout shape. */
  cutout: string;
  /** Primary button / selected toggle on the poster, and its label. */
  accent: string;
  accentInk: string;
  /** Nav highlight and its label. */
  pillActive: string;
  pillActiveInk: string;
}

/**
 * Build a theme from an outfit's top and bottom colours: the bottom colour
 * becomes the poster block, the top colour the title (falling back to a
 * readable colour when the two clash), and the nav highlight follows.
 */
export function themeFromPairing(top: string, bottom: string): OutfitTheme {
  const posterBg = `#${hexOf(bottom)}`;
  const topHex = `#${hexOf(top)}`;
  const posterFg = readableOn(posterBg);
  const posterTitle = contrast(topHex, posterBg) >= 3 ? topHex : posterFg;
  const cutout = contrast(topHex, posterBg) >= 1.5 ? topHex : posterFg;
  // The highlight sits on a white pill, so it needs to stand out from white.
  const pillActive = contrast(posterBg, PAPER) >= 1.6 ? posterBg : topHex;
  const pillActiveInk =
    contrast(pillActive, PAPER) >= 1.6 ? readableOn(pillActive) : readableOn('#5c1a26');
  // Buttons use the title colour when it's a strong match, else the readable ink.
  const accent = contrast(posterTitle, posterBg) >= 3 ? posterTitle : posterFg;
  return {
    posterBg,
    posterTitle,
    posterFg,
    cutout,
    accent,
    accentInk: readableOn(accent),
    pillActive: contrast(pillActive, PAPER) >= 1.6 ? pillActive : '#5c1a26',
    pillActiveInk,
  };
}
