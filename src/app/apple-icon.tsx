import { ImageResponse } from 'next/og';

// The Home Screen / Dock icon: the Tag F mark at 180px, drawn by Next.js at
// build time (so there's no binary file to keep in sync with icon.svg).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** The mark's colours (Fog & Slate). */
export const ICON_COLORS = { slate: '#4a6276', fog: '#f4f6f7' };

export default function AppleIcon() {
  const { slate, fog } = ICON_COLORS;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: slate }}>
      <svg viewBox="0 0 64 64" width="180" height="180">
        <path
          d="M22 18 L32 10 L42 18 V52 a3 3 0 0 1 -3 3 H25 a3 3 0 0 1 -3 -3 Z"
          fill={fog}
          stroke={fog}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="18" r="2.6" fill={slate} />
        <g fill="none" stroke={slate} strokeWidth="4" strokeLinecap="round">
          <path d="M28 27 V47" />
          <path d="M28 27 H37" />
          <path d="M28 36 H35" />
        </g>
      </svg>
    </div>,
    size,
  );
}
