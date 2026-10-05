'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { themeFromPairing } from '@/lib/outfitTheme';

type Pairing = [top: string, bottom: string];

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

/**
 * Lets the latest generated outfit restyle the app: its colours are exposed
 * as CSS variables that the poster headers and the nav highlight read.
 * Without a pairing the default burgundy / sky blue applies.
 */
export function OutfitThemeProvider({ children }: { children: React.ReactNode }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const value = useMemo(() => ({ pairing, setPairing }), [pairing]);

  const style = useMemo(() => {
    if (!pairing) return undefined;
    const t = themeFromPairing(pairing[0], pairing[1]);
    return {
      '--poster-bg': t.posterBg,
      '--poster-title': t.posterTitle,
      '--poster-fg': t.posterFg,
      '--poster-cutout': t.cutout,
      '--poster-accent': t.accent,
      '--poster-accent-ink': t.accentInk,
      '--pill-active': t.pillActive,
      '--pill-active-ink': t.pillActiveInk,
    } as React.CSSProperties;
  }, [pairing]);

  return (
    <OutfitThemeContext.Provider value={value}>
      <div style={style} className="contents">
        {children}
      </div>
    </OutfitThemeContext.Provider>
  );
}
