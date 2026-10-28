'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { themeFromOutfit } from '@/lib/outfitTheme';

/** Today's outfit colours: top, bottom and (if it has one) shoes. */
type Pairing = [top: string, bottom: string, shoes?: string | null];

interface OutfitThemeValue {
  /** The outfit colours currently styling the app, if any. */
  pairing: Pairing | null;
  setPairing: (pairing: Pairing | null) => void;
}

const OutfitThemeContext = createContext<OutfitThemeValue>({
  pairing: null,
  setPairing: () => {},
});

export function useOutfitTheme() {
  return useContext(OutfitThemeContext);
}

/** The registered outfit colours fade between outfits (see globals.css). */
const FADE = [
  '--outfit-top 1.2s ease',
  '--outfit-bottom 1.2s ease',
  '--outfit-shoes 1.2s ease',
  '--outfit-accent 0.9s ease',
  '--outfit-accent-ink 0.9s ease',
  '--outfit-tint 0.9s ease',
  '--outfit-glow 0.9s ease',
].join(', ');

/**
 * Lets the latest generated outfit restyle the whole app: the top's colour
 * becomes the accent (buttons, links, selected states, nav, header), the
 * bottom's and the shoes' the secondary and third colours. Without an outfit
 * the app is neutral, so the colour arrives with the outfit.
 */
export function OutfitThemeProvider({ children }: { children: React.ReactNode }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const value = useMemo(() => ({ pairing, setPairing }), [pairing]);

  const style = useMemo(() => {
    if (!pairing) return { transition: FADE } as React.CSSProperties;
    const t = themeFromOutfit(pairing[0], pairing[1], pairing[2]);
    return {
      transition: FADE,
      '--poster-bg': t.posterBg,
      '--poster-title': t.posterTitle,
      '--poster-fg': t.posterFg,
      '--poster-cutout': t.cutout,
      '--poster-script': t.script,
      '--poster-accent': t.accent,
      '--poster-accent-ink': t.accentInk,
      '--pill-active': t.pillActive,
      '--pill-active-ink': t.pillActiveInk,
      '--outfit-top': t.top,
      '--outfit-bottom': t.bottom,
      '--outfit-shoes': t.shoes,
      '--outfit-accent': t.uiAccent,
      '--outfit-accent-ink': t.uiAccentInk,
      '--outfit-tint': t.uiTint,
      '--outfit-glow': t.glow,
    } as React.CSSProperties;
  }, [pairing]);

  return (
    <OutfitThemeContext.Provider value={value}>
      <div style={style} data-outfit-theme={pairing ? 'outfit' : 'neutral'}>
        {children}
      </div>
    </OutfitThemeContext.Provider>
  );
}
