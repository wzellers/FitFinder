'use client';

import React from 'react';
import { Snowflake } from '@/components/ui/WeatherBackdrop';
import type { SeasonalTheme } from '@/lib/seasons';

// Seasonal touches on the Outfits screen, alongside the weather: falling
// petals, leaves or confetti and things on the ground (SeasonalBackdrop,
// behind the whole screen), and decorations hung in the sky strip above the
// "Today's fit" banner (SeasonalSky). Decorative, and still for users who
// prefer reduced motion.

/** A repeatable pseudo-random number in [0, 1) for item `i`. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const CONFETTI = ['#e5484d', '#f5c542', '#30a46c', '#3e8ef7', '#e93d82', '#8e4ec6'];
const FALL_LEAVES = ['#c2410c', '#d97706', '#b91c1c', '#ca8a04', '#9a3412'];
const PETALS = ['#f9c6d3', '#f4a7bb', '#fbd5e0'];
const PASTELS = ['#f9c6d3', '#bfe3f5', '#fde68a', '#c7f0d0', '#ddd0f7'];

interface BackdropProps {
  theme: SeasonalTheme;
  /** Night time: fireflies, fireworks and a dusk sky. */
  night?: boolean;
  /** Which night of Hanukkah (1–8): that many candles are lit. */
  hanukkahNight?: number;
}

/** Things falling, rising or flying across the whole screen, and on the
 * ground, for the season or holiday. */
export function SeasonalBackdrop({ theme, night = false, hanukkahNight = 8 }: BackdropProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="seasonal-backdrop"
      data-theme={theme}
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {theme === 'winter' && (
        <>
          <div className="sz-frost sz-frost-tl" />
          <div className="sz-frost sz-frost-tr" />
          <div className="sz-frost sz-frost-bl" />
          <div className="sz-frost sz-frost-br" />
          {range(12).map((i) => (
            <Snowflake
              key={i}
              className="wx-crystal"
              size={10 + rand(i, 3) * 10}
              style={{
                left: `${rand(i, 1) * 100}%`,
                animationDelay: `${-rand(i, 4) * 20}s`,
                animationDuration: `${16 + rand(i, 5) * 10}s`,
              }}
            />
          ))}
        </>
      )}

      {theme === 'spring' && (
        <>
          <Falling count={22} className="sz-petal" colors={PETALS} spin />
          <Meadow />
          {range(3).map((i) => (
            <Butterfly key={i} index={i} />
          ))}
        </>
      )}

      {theme === 'summer' && (
        <>
          {night ? (
            range(26).map((i) => (
              <span
                key={i}
                className="sz-firefly"
                style={{
                  left: `${rand(i, 1) * 100}%`,
                  top: `${30 + rand(i, 2) * 62}%`,
                  animationDelay: `${-rand(i, 4) * 8}s, ${-rand(i, 6) * 3}s`,
                }}
              />
            ))
          ) : (
            <div className="sz-shimmer" />
          )}
          <Beach night={night} />
        </>
      )}

      {(theme === 'fall' || theme === 'thanksgiving') && (
        <>
          {range(theme === 'thanksgiving' ? 30 : 22).map((i) => (
            <Leaf
              key={i}
              color={FALL_LEAVES[i % FALL_LEAVES.length]}
              size={16 + rand(i, 3) * 14}
              style={{
                left: `${rand(i, 1) * 100}%`,
                animationDelay: `${-rand(i, 4) * 18}s`,
                animationDuration: `${12 + rand(i, 5) * 9}s`,
              }}
            />
          ))}
          {theme === 'fall' ? <LeafPile /> : <Harvest />}
        </>
      )}

      {theme === 'newyear' && (
        <>
          <Falling count={60} className="sz-confetti" colors={CONFETTI} spin />
          <Fireworks colors={CONFETTI} />
        </>
      )}

      {theme === 'lunarnewyear' &&
        range(6).map((i) => (
          <span
            key={i}
            className="sz-sky-lantern"
            style={{
              left: `${8 + rand(i, 1) * 84}%`,
              animationDelay: `${-rand(i, 4) * 24}s`,
              animationDuration: `${20 + rand(i, 5) * 10}s`,
            }}
          />
        ))}

      {theme === 'valentines' &&
        range(18).map((i) => (
          <Heart
            key={i}
            className="sz-rise"
            color={i % 3 === 0 ? '#f472b6' : '#e5484d'}
            size={14 + rand(i, 3) * 16}
            style={{
              left: `${rand(i, 1) * 100}%`,
              animationDelay: `${-rand(i, 4) * 16}s`,
              animationDuration: `${12 + rand(i, 5) * 8}s`,
            }}
          />
        ))}

      {theme === 'stpatricks' &&
        range(20).map((i) => (
          <Shamrock
            key={i}
            size={16 + rand(i, 3) * 14}
            style={{
              left: `${rand(i, 1) * 100}%`,
              animationDelay: `${-rand(i, 4) * 16}s`,
              animationDuration: `${12 + rand(i, 5) * 8}s`,
            }}
          />
        ))}

      {theme === 'easter' && <EasterScene />}
      {theme === 'earthday' && (
        <>
          <Vine side="left" />
          <Vine side="right" />
        </>
      )}

      {theme === 'july4' && night && <Fireworks colors={['#e5484d', '#ffffff', '#3e8ef7']} />}

      {theme === 'backtoschool' &&
        range(3).map((i) => (
          <PaperPlane
            key={i}
            style={{
              top: `${18 + i * 22}%`,
              animationDelay: `${-i * 7}s`,
              animationDuration: `${18 + i * 4}s`,
            }}
          />
        ))}

      {theme === 'halloween' && (
        <>
          {night && <div className="sz-dusk" />}
          <SpiderWeb />
          <JackOLanterns />
        </>
      )}

      {theme === 'hanukkah' && (
        <>
          {range(14).map((i) => (
            <span
              key={i}
              className="sz-glint"
              style={{
                left: `${rand(i, 1) * 100}%`,
                top: `${rand(i, 2) * 70}%`,
                animationDelay: `${-rand(i, 4) * 4}s`,
              }}
            />
          ))}
          <Menorah lit={hanukkahNight} />
        </>
      )}

      {theme === 'christmas' && <ChristmasTree />}
    </div>
  );
}

interface SkyProps {
  theme: SeasonalTheme;
  night?: boolean;
  /** The weather's sun is out: summer gives it sunglasses. */
  sun?: boolean;
}

/** Decorations hung in the sky strip above the banner. */
export function SeasonalSky({ theme, night = false, sun = false }: SkyProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="seasonal-sky"
      data-theme={theme}
      className="absolute inset-x-0 -top-2 h-28 pointer-events-none overflow-hidden"
    >
      {theme === 'winter' && <Icicles />}
      {theme === 'christmas' && <LightString />}
      {theme === 'lunarnewyear' &&
        range(5).map((i) => (
          <Lantern key={i} style={{ left: `${10 + i * 20}%`, animationDelay: `${-i * 0.7}s` }} />
        ))}
      {theme === 'valentines' &&
        range(4).map((i) => (
          <Heart
            key={i}
            className="sz-drift"
            color="#f9a8c9"
            size={22 + rand(i, 3) * 16}
            style={{
              top: `${10 + rand(i, 2) * 45}%`,
              animationDelay: `${-i * 14}s`,
              animationDuration: `${55 + i * 6}s`,
            }}
          />
        ))}
      {theme === 'stpatricks' && <Rainbow />}
      {theme === 'july4' && <Bunting />}
      {theme === 'halloween' &&
        range(4).map((i) => (
          <Bat
            key={i}
            style={{
              top: `${12 + rand(i, 2) * 50}%`,
              animationDelay: `${-i * 6}s`,
              animationDuration: `${18 + i * 5}s`,
            }}
          />
        ))}
      {theme === 'spring' && <BlossomBranch />}
      {theme === 'easter' && <EggGarland />}
      {theme === 'summer' && sun && <Sunglasses />}
      {theme === 'summer' && !night && <Kite />}
      {theme === 'summer' &&
        !night &&
        range(3).map((i) => (
          <Gull
            key={i}
            style={{
              top: `${18 + i * 22}%`,
              animationDelay: `${-i * 13}s`,
              animationDuration: `${38 + i * 6}s`,
            }}
          />
        ))}
    </div>
  );
}

// ---- Pieces ---------------------------------------------------------------

function Falling({
  count,
  className,
  colors,
  spin,
}: {
  count: number;
  className: string;
  colors: string[];
  spin?: boolean;
}) {
  return (
    <>
      {range(count).map((i) => (
        <span
          key={i}
          className={`${className}${spin ? ' sz-fall' : ''}`}
          style={{
            left: `${rand(i, 1) * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${-rand(i, 4) * 14}s`,
            animationDuration: `${8 + rand(i, 5) * 8}s`,
          }}
        />
      ))}
    </>
  );
}

function Fireworks({ colors }: { colors: string[] }) {
  const bursts = [
    { left: '18%', top: '22%', delay: 0 },
    { left: '72%', top: '16%', delay: -1.3 },
    { left: '46%', top: '34%', delay: -2.4 },
  ];
  return (
    <>
      {bursts.map((b, n) => (
        <div
          key={n}
          className="sz-firework"
          data-testid="seasonal-firework"
          style={{ left: b.left, top: b.top }}
        >
          {range(14).map((i) => (
            <span
              key={i}
              className="sz-spark"
              style={
                {
                  '--a': `${(i * 360) / 14}deg`,
                  background: colors[(i + n) % colors.length],
                  animationDelay: `${b.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </>
  );
}

function Leaf({ color, size, style }: { color: string; size: number; style: React.CSSProperties }) {
  return (
    <svg
      className="sz-leaf sz-fall"
      style={style}
      viewBox="-10 -12 20 24"
      width={size}
      height={size}
    >
      <path d="M0 -11 C7 -6 8 2 0 11 C-8 2 -7 -6 0 -11 Z" fill={color} />
      <path d="M0 -9 V10" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
    </svg>
  );
}

function LeafPile() {
  return (
    <svg
      className="sz-ground-right"
      data-testid="seasonal-leaf-pile"
      viewBox="0 0 160 60"
      width="180"
      height="68"
    >
      {range(26).map((i) => (
        <path
          key={i}
          d="M0 -8 C5 -4 6 2 0 8 C-6 2 -5 -4 0 -8 Z"
          fill={FALL_LEAVES[i % FALL_LEAVES.length]}
          transform={`translate(${12 + rand(i, 1) * 136} ${30 + rand(i, 2) * 26 - (1 - Math.abs(rand(i, 1) - 0.5) * 2) * 18}) rotate(${rand(i, 3) * 360})`}
        />
      ))}
    </svg>
  );
}

function Harvest() {
  return (
    <svg
      className="sz-ground-right"
      data-testid="seasonal-harvest"
      viewBox="0 0 200 100"
      width="210"
      height="105"
    >
      {/* Basket */}
      <path d="M110 60 L190 60 L180 96 L120 96 Z" fill="#a0703f" />
      <path d="M114 70 H186 M117 80 H183 M119 90 H181" stroke="#7a5233" strokeWidth="2" />
      <path d="M118 60 Q150 20 182 60" fill="none" stroke="#7a5233" strokeWidth="4" />
      <circle cx="132" cy="56" r="9" fill="#b91c1c" />
      <circle cx="150" cy="54" r="10" fill="#d97706" />
      <ellipse cx="168" cy="56" rx="7" ry="12" fill="#ca8a04" transform="rotate(25 168 56)" />
      {/* Pumpkins */}
      <Pumpkin x={44} y={72} r={26} />
      <Pumpkin x={88} y={84} r={16} />
    </svg>
  );
}

function Pumpkin({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 1.15} ry={r} fill="#ea7a1e" />
      <ellipse cx={x} cy={y} rx={r * 0.55} ry={r} fill="#f08a2a" />
      <path d={`M${x} ${y - r} V${y + r}`} stroke="#c95f12" strokeWidth="1.5" />
      <rect x={x - 2.5} y={y - r - 8} width="5" height="10" rx="2" fill="#4d6b2f" />
    </g>
  );
}

function JackOLanterns() {
  return (
    <svg
      className="sz-ground-right"
      data-testid="seasonal-jack-o-lanterns"
      viewBox="0 0 170 90"
      width="190"
      height="100"
    >
      {[
        [50, 58, 30],
        [125, 68, 20],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <Pumpkin x={x} y={y} r={r} />
          <g className="sz-flicker" fill="#ffd34d">
            <path
              d={`M${x - r * 0.5} ${y - r * 0.2} l${r * 0.2} ${-r * 0.3} l${r * 0.2} ${r * 0.3} Z`}
            />
            <path
              d={`M${x + r * 0.1} ${y - r * 0.2} l${r * 0.2} ${-r * 0.3} l${r * 0.2} ${r * 0.3} Z`}
            />
            <path
              d={`M${x - r * 0.6} ${y + r * 0.2} q${r * 0.6} ${r * 0.5} ${r * 1.2} 0 l${-r * 0.2} ${r * 0.1} l${-r * 0.2} ${-r * 0.1} l${-r * 0.2} ${r * 0.1} l${-r * 0.2} ${-r * 0.1} Z`}
            />
          </g>
        </g>
      ))}
    </svg>
  );
}

function SpiderWeb() {
  return (
    <svg
      className="sz-web"
      data-testid="seasonal-web"
      viewBox="0 0 160 160"
      width="170"
      height="170"
    >
      <g stroke="rgba(70,70,90,0.55)" strokeWidth="1" fill="none">
        {range(6).map((i) => {
          const a = (i * Math.PI) / 10;
          return <path key={i} d={`M0 0 L${160 * Math.cos(a)} ${160 * Math.sin(a)}`} />;
        })}
        {[30, 60, 92, 126].map((r) => (
          <path
            key={r}
            d={range(6)
              .map((i) => {
                const a = (i * Math.PI) / 10;
                return `${i ? 'Q' + (r * 0.9 * Math.cos(a - 0.15)).toFixed(1) + ' ' + (r * 0.9 * Math.sin(a - 0.15)).toFixed(1) + ' ' : 'M'}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
              })
              .join(' ')}
          />
        ))}
      </g>
      <g className="sz-spider">
        <path d="M96 0 V70" stroke="rgba(70,70,90,0.6)" strokeWidth="1" />
        <circle cx="96" cy="76" r="6" fill="#1f2328" />
        <g stroke="#1f2328" strokeWidth="1.4" fill="none">
          <path d="M91 74 l-7 -5 M91 77 l-8 0 M91 80 l-7 5 M101 74 l7 -5 M101 77 l8 0 M101 80 l7 5" />
        </g>
      </g>
    </svg>
  );
}

function Heart({
  className,
  color,
  size,
  style,
}: {
  className: string;
  color: string;
  size: number;
  style: React.CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="-11 -11 22 18" width={size} height={size}>
      <path
        d="M0 6 C-7 0 -11 -5 -7 -9 C-4 -11 -1 -9 0 -6 C1 -9 4 -11 7 -9 C11 -5 7 0 0 6 Z"
        fill={color}
      />
    </svg>
  );
}

function Shamrock({ size, style }: { size: number; style: React.CSSProperties }) {
  const leaf = 'M0 0 C-6 -4 -6 -10 -2 -11 C0 -11 0 -9 0 -8 C0 -9 0 -11 2 -11 C6 -10 6 -4 0 0 Z';
  return (
    <svg
      className="sz-leaf sz-fall"
      style={style}
      viewBox="-12 -12 24 26"
      width={size}
      height={size}
    >
      <g fill="#2f9e44">
        <path d={leaf} />
        <path d={leaf} transform="rotate(120)" />
        <path d={leaf} transform="rotate(240)" />
      </g>
      <path d="M0 0 Q2 7 5 12" stroke="#2b7a3a" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** One spring flower, drawn on its own at a fixed size: a daisy, a tulip
 * or a five-petal blossom on a stem with a leaf. */
function Flower({ kind, height, color }: { kind: number; height: number; color: string }) {
  const h = height;
  return (
    <svg
      viewBox={`-12 ${-h - 12} 24 ${h + 12}`}
      width="34"
      height={((h + 12) * 34) / 24}
      className="block"
    >
      <path
        d={`M0 0 Q${kind % 2 ? 2 : -2} ${-h / 2} 0 ${-h}`}
        stroke="#4f8a3a"
        strokeWidth="1.8"
        fill="none"
      />
      <path d={`M0 ${-h * 0.35} q7 -6 10 -2 q-4 5 -10 2`} fill="#5f9e46" />
      <path d={`M0 ${-h * 0.55} q-7 -6 -10 -2 q4 5 10 2`} fill="#6aad4f" />
      {kind === 0 && (
        // Daisy: thin white petals round a yellow middle.
        <g transform={`translate(0 ${-h})`}>
          {range(10).map((p) => (
            <ellipse
              key={p}
              rx="1.6"
              ry="5"
              cy="-5"
              fill="#ffffff"
              stroke="#e6e1d6"
              strokeWidth="0.4"
              transform={`rotate(${p * 36})`}
            />
          ))}
          <circle r="3" fill="#f5c542" stroke="#e0a922" strokeWidth="0.6" />
        </g>
      )}
      {kind === 1 && (
        // Tulip: a cup of three petals.
        <g transform={`translate(0 ${-h})`}>
          <path
            d="M-6 -2 C-7 -9 -4 -12 -2 -12 L0 -7 L2 -12 C4 -12 7 -9 6 -2 C5 3 -5 3 -6 -2 Z"
            fill={color}
          />
          <path d="M0 -7 C-2 -2 -2 1 0 2 C2 1 2 -2 0 -7 Z" fill="rgba(0,0,0,0.12)" />
        </g>
      )}
      {kind === 2 && (
        // Blossom: five round petals with a speckled middle.
        <g transform={`translate(0 ${-h})`}>
          {range(5).map((p) => (
            <circle
              key={p}
              cx={4 * Math.cos((p * 2 * Math.PI) / 5 - Math.PI / 2)}
              cy={4 * Math.sin((p * 2 * Math.PI) / 5 - Math.PI / 2)}
              r="3.6"
              fill={color}
            />
          ))}
          <circle r="2.2" fill="#f5c542" />
          <circle r="0.7" cx="0.8" cy="-0.5" fill="#c98a12" />
        </g>
      )}
    </svg>
  );
}

const TULIPS = ['#e5484d', '#f472b6', '#c084fc', '#f5c542', '#fb923c'];

/** A strip of grass along the bottom, full of mixed spring flowers. */
function Meadow() {
  return (
    <div className="sz-ground h-24" data-testid="seasonal-flowers">
      <Grass className="absolute inset-x-0 bottom-0 w-full h-10" />
      {range(30).map((i) => {
        const kind = i % 3;
        return (
          <div
            key={i}
            className="sz-flower sz-sway"
            style={{
              left: `${(i + 0.2 + rand(i, 1) * 0.6) * (100 / 30)}%`,
              animationDelay: `${-rand(i, 4) * 4}s`,
            }}
          >
            <Flower
              kind={kind}
              height={24 + rand(i, 2) * 30}
              color={kind === 1 ? TULIPS[i % TULIPS.length] : PASTELS[i % PASTELS.length]}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Two layers of grass blades, stretched to the screen's width. */
function Grass({ className }: { className: string }) {
  const blades = (seed: number, base: number, tall: number) =>
    `M0 50 ${range(101)
      .map((i) => `L${i * 4} ${i % 2 ? base - tall * (0.4 + rand(i, seed) * 0.6) : base}`)
      .join(' ')} L400 50 Z`;
  return (
    <svg className={className} viewBox="0 0 400 50" preserveAspectRatio="none">
      <path d={blades(11, 30, 26)} fill="#5aa64a" />
      <path d={blades(13, 38, 20)} fill="#7cc46a" />
      <rect y="44" width="400" height="6" fill="#6db75c" />
    </svg>
  );
}

const BUTTERFLIES = [
  { wing: '#8e4ec6', inner: '#c084fc', top: '38%', delay: 0 },
  { wing: '#f08a24', inner: '#fcd34d', top: '58%', delay: -9 },
  { wing: '#3e8ef7', inner: '#93c5fd', top: '28%', delay: -17 },
];

function Butterfly({ index }: { index: number }) {
  const b = BUTTERFLIES[index % BUTTERFLIES.length];
  const wings = (
    <>
      <path
        d="M0 0 C-4 -10 -13 -11 -12 -3 C-11 2 -5 3 0 0 Z"
        fill={b.wing}
        stroke="#2b3440"
        strokeWidth="0.6"
      />
      <path
        d="M0 0 C-3 5 -10 9 -9 3 C-8 1 -4 1 0 0 Z"
        fill={b.inner}
        stroke="#2b3440"
        strokeWidth="0.6"
      />
      <circle cx="-7" cy="-5" r="1.6" fill="#ffffff" />
      <circle cx="-9.5" cy="-2" r="0.9" fill="#ffffff" />
      <circle cx="-5" cy="4" r="1" fill="#2b3440" />
    </>
  );
  return (
    <div
      className="sz-butterfly-path"
      data-testid="seasonal-butterfly"
      style={{ top: b.top, animationDelay: `${b.delay}s` }}
    >
      <svg className="sz-butterfly" viewBox="-13 -12 26 22" width="38" height="32">
        <g className="sz-wing">{wings}</g>
        <g transform="scale(-1 1)">
          <g className="sz-wing">{wings}</g>
        </g>
        <path d="M0 -6 V7" stroke="#2b3440" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M0 -6 Q-2 -10 -4 -11 M0 -6 Q2 -10 4 -11"
          stroke="#2b3440"
          strokeWidth="0.7"
          fill="none"
        />
      </svg>
    </div>
  );
}

/** A cherry-blossom branch reaching in from the top-left of the sky. */
function BlossomBranch() {
  const flowers = [
    [38, 14, 1],
    [62, 24, 0.85],
    [90, 12, 1.1],
    [118, 30, 0.9],
    [146, 18, 1],
    [176, 34, 0.8],
    [204, 22, 0.95],
    [74, 40, 0.75],
    [132, 46, 0.7],
  ] as const;
  return (
    <svg
      className="absolute left-0 top-0"
      data-testid="seasonal-blossoms"
      viewBox="0 0 240 70"
      width="300"
      height="88"
    >
      <path
        d="M0 6 C50 10 90 22 150 26 C185 28 210 24 236 30"
        stroke="#6b4a2f"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M80 20 C90 32 100 40 118 44 M150 26 C160 36 170 40 182 40"
        stroke="#6b4a2f"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      {flowers.map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
          {/* The sway goes on an inner group: a CSS animation would
              replace the position set on this one. */}
          <g className="sz-twirl" style={{ animationDelay: `${-i * 0.5}s` }}>
            {range(5).map((p) => (
              <ellipse
                key={p}
                rx="4"
                ry="5.5"
                cy="-5"
                fill={i % 2 ? '#fbd5e0' : '#f9c6d3'}
                stroke="#f4a7bb"
                strokeWidth="0.5"
                transform={`rotate(${p * 72})`}
              />
            ))}
            <circle r="2.2" fill="#e93d82" />
          </g>
        </g>
      ))}
      {[
        [24, 8],
        [104, 24],
        [228, 30],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#f4a7bb" />
      ))}
    </svg>
  );
}

/** Easter: a meadow with decorated eggs, tulips, a basket of eggs and a
 * bunny hopping past now and then. */
function EasterScene() {
  return (
    <div className="sz-ground h-28" data-testid="seasonal-eggs">
      <Grass className="absolute inset-x-0 bottom-0 w-full h-12" />
      {range(8).map((i) => (
        <div
          key={`f${i}`}
          className="sz-flower sz-sway"
          style={{ left: `${3 + i * 12.5 + rand(i, 3) * 5}%`, animationDelay: `${-i * 0.6}s` }}
        >
          <Flower kind={1} height={26 + rand(i, 2) * 18} color={TULIPS[i % TULIPS.length]} />
        </div>
      ))}
      {range(9).map((i) => (
        <svg
          key={i}
          className="sz-egg"
          style={{
            left: `${5 + i * 10.5 + rand(i, 1) * 4}%`,
            rotate: `${(rand(i, 2) - 0.5) * 30}deg`,
          }}
          viewBox="-10 -12 20 24"
          width="28"
          height="34"
        >
          <EasterEgg
            pattern={i % 4}
            color={PASTELS[i % PASTELS.length]}
            accent={PASTELS[(i + 2) % PASTELS.length]}
          />
        </svg>
      ))}
      <EggBasket />
      <Bunny />
    </div>
  );
}

/** A decorated egg (drawn in a -10 -12 20 24 box) with one of four patterns. */
function EasterEgg({ pattern, color, accent }: { pattern: number; color: string; accent: string }) {
  const id = `egg-${pattern}-${color.slice(1)}`;
  return (
    <>
      <defs>
        <clipPath id={id}>
          <ellipse rx="8.5" ry="11" />
        </clipPath>
      </defs>
      <ellipse rx="8.5" ry="11" fill={color} />
      <g clipPath={`url(#${id})`}>
        {pattern === 0 && (
          <path
            d="M-9 0 L-6 -3 L-3 0 L0 -3 L3 0 L6 -3 L9 0"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.8"
          />
        )}
        {pattern === 1 && (
          <>
            <rect x="-9" y="-4" width="18" height="2.6" fill={accent} />
            <rect x="-9" y="2" width="18" height="2.6" fill="#ffffff" />
          </>
        )}
        {pattern === 2 &&
          [
            [-3, -6],
            [3, -4],
            [-4, 1],
            [2, 3],
            [-1, 7],
            [5, 7],
          ].map(([x, y], d) => (
            <circle key={d} cx={x} cy={y} r="1.5" fill={d % 2 ? '#ffffff' : accent} />
          ))}
        {pattern === 3 && (
          <>
            <path d="M-9 -2 Q-4.5 -6 0 -2 T9 -2" fill="none" stroke={accent} strokeWidth="2" />
            <path d="M-9 4 Q-4.5 0 0 4 T9 4" fill="none" stroke="#ffffff" strokeWidth="1.6" />
          </>
        )}
      </g>
      <ellipse rx="8.5" ry="11" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" />
      <ellipse cx="-3.5" cy="-5" rx="1.6" ry="3" fill="rgba(255,255,255,0.55)" />
    </>
  );
}

function EggBasket() {
  return (
    <svg
      className="sz-ground-right"
      data-testid="seasonal-basket"
      viewBox="0 0 120 90"
      width="130"
      height="98"
    >
      <path d="M14 46 Q60 -10 106 46" fill="none" stroke="#9a6a3a" strokeWidth="5" />
      {[
        [34, 44, 0],
        [52, 38, 1],
        [70, 40, 2],
        [86, 46, 3],
      ].map(([x, y, p], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${(i - 1.5) * 12})`}>
          <EasterEgg
            pattern={p}
            color={PASTELS[(i + 1) % PASTELS.length]}
            accent={PASTELS[(i + 3) % PASTELS.length]}
          />
        </g>
      ))}
      <path d="M10 48 H110 L100 86 H20 Z" fill="#b5844f" />
      <path d="M13 58 H107 M16 68 H104 M18 78 H102" stroke="#8a5f33" strokeWidth="2.2" />
      {range(9).map((i) => (
        <path key={i} d={`M${22 + i * 10} 48 V86`} stroke="#9a6a3a" strokeWidth="1.4" />
      ))}
      <path d="M8 46 H112" stroke="#8a5f33" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Bunny() {
  return (
    <div className="sz-hop" data-testid="seasonal-bunny">
      <svg className="sz-hop-body" viewBox="0 0 60 50" width="62" height="52">
        <ellipse cx="26" cy="34" rx="16" ry="12" fill="#f1ece4" />
        <circle cx="10" cy="34" r="5" fill="#ffffff" />
        <circle cx="42" cy="24" r="9" fill="#f1ece4" />
        <ellipse cx="38" cy="8" rx="3.2" ry="10" fill="#f1ece4" transform="rotate(-12 38 8)" />
        <ellipse cx="38" cy="8" rx="1.6" ry="7" fill="#f6c1cf" transform="rotate(-12 38 8)" />
        <ellipse cx="45" cy="8" rx="3.2" ry="10" fill="#f1ece4" transform="rotate(10 45 8)" />
        <ellipse cx="45" cy="8" rx="1.6" ry="7" fill="#f6c1cf" transform="rotate(10 45 8)" />
        <circle cx="45" cy="22" r="1.4" fill="#2b3440" />
        <circle cx="50" cy="26" r="1.3" fill="#e991a9" />
        <ellipse cx="34" cy="45" rx="6" ry="3" fill="#e6dfd3" />
        <ellipse cx="18" cy="45" rx="5" ry="3" fill="#e6dfd3" />
      </svg>
    </div>
  );
}

/** A string of pastel eggs hung across the sky. */
function EggGarland() {
  const n = 16;
  return (
    <div className="absolute inset-x-0 top-0 h-12" data-testid="seasonal-egg-garland">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
      >
        <path
          d={sagPath()}
          fill="none"
          stroke="#b9a58a"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {range(n).map((i) => {
        const x = (i + 0.5) / n;
        return (
          <svg
            key={i}
            className="sz-hang"
            style={{ left: `${x * 100}%`, top: sag(x) - 2, animationDelay: `${-i * 0.35}s` }}
            viewBox="-10 -15 20 27"
            width="18"
            height="24"
          >
            <path d="M0 -15 V-11" stroke="#b9a58a" strokeWidth="1" />
            <EasterEgg
              pattern={i % 4}
              color={PASTELS[i % PASTELS.length]}
              accent={PASTELS[(i + 2) % PASTELS.length]}
            />
          </svg>
        );
      })}
    </div>
  );
}

function Vine({ side }: { side: 'left' | 'right' }) {
  // Grows the full height of the screen, winding up the edge.
  const H = 800;
  const turns = 7;
  const stem = range(turns + 1)
    .map((i) => {
      const y = H - (i * H) / turns;
      if (i === 0) return `M40 ${y}`;
      const prevY = H - ((i - 1) * H) / turns;
      const bend = i % 2 ? 72 : 8;
      return `C${bend} ${prevY - (H / turns) * 0.3} ${bend} ${y + (H / turns) * 0.3} 40 ${y}`;
    })
    .join(' ');
  return (
    <svg
      className={`sz-vine sz-vine-${side}`}
      data-testid="seasonal-vine"
      viewBox={`0 0 80 ${H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <path
        className="sz-vine-stem"
        d={stem}
        pathLength={1}
        fill="none"
        stroke="#3f7d3a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {range(22).map((i) => {
        const y = H - 20 - i * ((H - 40) / 21);
        const t = (H - y) / (H / turns);
        const x = 40 + 26 * Math.sin(t * Math.PI) * (Math.floor(t) % 2 ? -1 : 1);
        const out = i % 2 ? 1 : -1;
        return (
          <path
            key={i}
            className="sz-vine-leaf"
            style={{ animationDelay: `${0.2 + (i / 22) * 2.6}s` }}
            d={`M${x} ${y} c${out * 10} -9 ${out * 18} 1 0 9 Z`}
            fill={i % 3 ? '#5aa64a' : '#76bf5e'}
          />
        );
      })}
    </svg>
  );
}

function PaperPlane({ style }: { style: React.CSSProperties }) {
  return (
    <svg
      className="sz-plane"
      data-testid="seasonal-plane"
      style={style}
      viewBox="0 0 40 24"
      width="46"
      height="28"
    >
      <path d="M0 12 L40 0 L22 24 L17 15 Z" fill="#ffffff" stroke="#9aa6b2" strokeWidth="1" />
      <path d="M17 15 L40 0" stroke="#9aa6b2" strokeWidth="1" />
    </svg>
  );
}

function Menorah({ lit }: { lit: number }) {
  // Eight candles plus the taller helper candle (shamash) in the middle,
  // lit right to left as the nights go on.
  const xs = [14, 28, 42, 56, 84, 98, 112, 126];
  return (
    <svg
      className="sz-ground-right"
      data-testid="seasonal-menorah"
      viewBox="0 0 140 120"
      width="160"
      height="137"
    >
      <g stroke="#c9a227" strokeWidth="4" fill="none" strokeLinecap="round">
        {xs.map((x) => (
          <path key={x} d={`M${x} 52 Q${x} 78 70 82`} />
        ))}
        <path d="M70 40 V108" />
        <path d="M46 114 H94" strokeWidth="6" />
      </g>
      {[...xs, 70].map((x, i) => {
        const shamash = i === 8;
        const top = shamash ? 26 : 38;
        // Night n lights the n right-most candles.
        const on = shamash || 7 - i < lit;
        return (
          <g key={x}>
            <rect x={x - 3} y={top} width="6" height="14" rx="1" fill="#bcd4f6" />
            {on && (
              <path
                className="sz-flame"
                data-testid="menorah-flame"
                d={`M${x} ${top - 12} C${x + 4} ${top - 6} ${x + 3} ${top - 1} ${x} ${top - 1} C${x - 3} ${top - 1} ${x - 4} ${top - 6} ${x} ${top - 12} Z`}
                fill="#ffc94d"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ChristmasTree() {
  const ornaments = [
    [48, 46, '#e5484d'],
    [38, 64, '#f5c542'],
    [60, 70, '#3e8ef7'],
    [32, 92, '#e93d82'],
    [52, 96, '#e5484d'],
    [70, 100, '#f5c542'],
    [42, 120, '#3e8ef7'],
    [66, 124, '#e93d82'],
  ] as const;
  return (
    <svg
      className="wx-tree"
      data-testid="seasonal-tree"
      viewBox="0 0 100 160"
      width="110"
      height="176"
    >
      <rect x="44" y="134" width="12" height="20" rx="2" fill="#7a5233" />
      <g fill="#2f7a4a">
        <path d="M50 20 L78 64 L22 64 Z" />
        <path d="M50 44 L86 100 L14 100 Z" />
        <path d="M50 76 L94 138 L6 138 Z" />
      </g>
      {ornaments.map(([x, y, c], i) => (
        <circle
          key={i}
          className="wx-ornament"
          cx={x}
          cy={y}
          r="4"
          fill={c}
          style={{ animationDelay: `${-i * 0.35}s` }}
        />
      ))}
      <path
        className="wx-tree-star"
        d="M50 4 L54 14 L65 14 L56 21 L59 32 L50 25 L41 32 L44 21 L35 14 L46 14 Z"
        fill="#f5c542"
      />
    </svg>
  );
}

/** How far a string hung across the strip sags at `x` (0–1), in px. */
const sag = (x: number) => 6 + 10 * Math.abs(Math.sin(x * Math.PI * 3));
const sagPath = () =>
  range(61)
    .map((i) => `${i ? 'L' : 'M'}${(i / 60) * 100} ${sag(i / 60)}`)
    .join(' ');

function LightString() {
  const bulbs = ['#e5484d', '#30a46c', '#f5c542', '#3e8ef7', '#e93d82'];
  const n = 18;
  return (
    <div className="absolute inset-x-0 top-0 h-8" data-testid="seasonal-lights">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
      >
        <path
          d={sagPath()}
          fill="none"
          stroke="#2f3a2f"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {range(n).map((i) => {
        const x = (i + 0.5) / n;
        return (
          <span
            key={i}
            className="wx-bulb"
            style={{
              left: `${x * 100}%`,
              top: sag(x) - 1,
              color: bulbs[i % bulbs.length],
              animationDelay: `${-(i % 5) * 0.4}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function Bunting() {
  const colors = ['#e5484d', '#ffffff', '#3e8ef7'];
  const n = 22;
  return (
    <div className="absolute inset-x-0 top-0 h-10" data-testid="seasonal-bunting">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
      >
        <path
          d={sagPath()}
          fill="none"
          stroke="#55606b"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {range(n).map((i) => {
        const x = (i + 0.5) / n;
        return (
          <span
            key={i}
            className="sz-flag"
            style={{
              left: `${x * 100}%`,
              top: sag(x),
              borderTopColor: colors[i % colors.length],
              animationDelay: `${-i * 0.3}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function Icicles() {
  // A snowy ledge with icicles of many lengths: each tapers to a point,
  // shaded from frosty white to clear blue, with a glint down one side and
  // now and then a drip.
  const n = 120;
  return (
    <svg
      className="absolute inset-x-0 top-0 w-full h-16"
      data-testid="seasonal-icicles"
      viewBox="0 0 1600 64"
      preserveAspectRatio="xMinYMin slice"
    >
      <defs>
        <linearGradient id="sz-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4fbff" />
          <stop offset="0.5" stopColor="#bfe0f7" />
          <stop offset="1" stopColor="#7fb8e6" />
        </linearGradient>
      </defs>
      {range(n).map((i) => {
        const x = (i + 0.5) * (1600 / n) + (rand(i, 1) - 0.5) * 4;
        const long = i % 5 === 2 || rand(i, 2) > 0.8;
        const len = long ? 36 + rand(i, 3) * 22 : 10 + rand(i, 3) * 18;
        const w = long ? 8 : 5 + rand(i, 4) * 2.5;
        const kink = (rand(i, 5) - 0.5) * 2;
        return (
          <g key={i}>
            <path
              d={`M${x - w} 6 C${x - w * 0.8} ${6 + len * 0.4} ${x - w * 0.25 + kink} ${6 + len * 0.8} ${x + kink} ${6 + len} C${x + w * 0.25 + kink} ${6 + len * 0.8} ${x + w * 0.8} ${6 + len * 0.4} ${x + w} 6 Z`}
              fill="url(#sz-ice)"
              stroke="rgba(90, 150, 210, 0.75)"
              strokeWidth="0.8"
            />
            <path
              d={`M${x - w * 0.45} 8 Q${x - w * 0.3} ${6 + len * 0.5} ${x + kink * 0.6} ${6 + len * 0.85}`}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.2"
              fill="none"
            />
            {long && (
              <circle
                className="sz-drip"
                cx={x + kink}
                cy={6 + len + 2}
                r="1.4"
                fill="#bfe0f7"
                style={{ animationDelay: `${-rand(i, 6) * 4}s` }}
              />
            )}
          </g>
        );
      })}
      {/* Snow on the ledge */}
      <path
        d={`M0 0 H1600 V7 ${range(161)
          .map((i) => `Q${1600 - i * 10 + 5} ${11 + rand(i, 7) * 4} ${1600 - (i + 1) * 10} 7`)
          .join(' ')} Z`}
        fill="#ffffff"
        stroke="rgba(170, 205, 235, 0.7)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function Lantern({ style }: { style: React.CSSProperties }) {
  return (
    <svg
      className="sz-lantern"
      data-testid="seasonal-lantern"
      style={style}
      viewBox="0 0 40 80"
      width="34"
      height="68"
    >
      <path d="M20 0 V12" stroke="#7a1d1d" strokeWidth="1.5" />
      <rect x="12" y="10" width="16" height="5" rx="1.5" fill="#d4a017" />
      <ellipse cx="20" cy="34" rx="16" ry="20" fill="#d7262e" />
      <path
        d="M10 34 Q20 14 30 34 Q20 54 10 34 M20 14 V54"
        fill="none"
        stroke="#a3161d"
        strokeWidth="1"
      />
      <rect x="12" y="52" width="16" height="5" rx="1.5" fill="#d4a017" />
      <path d="M20 57 V76 M17 60 V74 M23 60 V74" stroke="#d4a017" strokeWidth="1.2" />
    </svg>
  );
}

function Rainbow() {
  const bands = ['#e5484d', '#f08a24', '#f5c542', '#30a46c', '#3e8ef7', '#8e4ec6'];
  return (
    <svg
      className="absolute left-6 top-3"
      data-testid="seasonal-rainbow"
      viewBox="0 0 200 100"
      width="220"
      height="110"
    >
      {bands.map((c, i) => (
        <path
          key={c}
          d={`M${10 + i * 7} 100 A${90 - i * 7} ${90 - i * 7} 0 0 1 ${190 - i * 7} 100`}
          fill="none"
          stroke={c}
          strokeWidth="7"
          opacity="0.75"
        />
      ))}
    </svg>
  );
}

function Bat({ style }: { style: React.CSSProperties }) {
  return (
    <svg
      className="sz-drift sz-bat"
      data-testid="seasonal-bat"
      style={style}
      viewBox="-20 -8 40 16"
      width="40"
      height="16"
    >
      <path
        className="sz-bat-wings"
        d="M0 -2 C-4 -6 -10 -7 -20 -2 C-14 -2 -13 2 -10 3 C-8 0 -5 1 -3 4 L0 2 L3 4 C5 1 8 0 10 3 C13 2 14 -2 20 -2 C10 -7 4 -6 0 -2 Z"
        fill="#2a2433"
      />
    </svg>
  );
}

function Sunglasses() {
  return (
    <svg
      className="sz-sunglasses"
      data-testid="seasonal-sunglasses"
      viewBox="0 0 60 22"
      width="62"
      height="23"
    >
      <defs>
        <linearGradient id="sz-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b4a5e" />
          <stop offset="1" stopColor="#11161d" />
        </linearGradient>
      </defs>
      <path d="M2 5 Q30 1 58 5" stroke="#1f2328" strokeWidth="2.5" fill="none" />
      <path
        d="M5 4 H27 Q27 19 16 19 Q5 19 5 4 Z"
        fill="url(#sz-lens)"
        stroke="#11161d"
        strokeWidth="1"
      />
      <path
        d="M33 4 H55 Q55 19 44 19 Q33 19 33 4 Z"
        fill="url(#sz-lens)"
        stroke="#11161d"
        strokeWidth="1"
      />
      <path
        d="M8 7 L13 7 M10 10 L12 10"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M36 7 L41 7"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M22 15 Q30 20 38 15"
        stroke="#c96f12"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A seagull gliding across the sky strip, flapping now and then. */
function Gull({ style }: { style: React.CSSProperties }) {
  return (
    <svg className="sz-drift" style={style} viewBox="-16 -8 32 14" width="34" height="15">
      <g className="sz-gull-wings">
        <path
          d="M0 0 Q-6 -7 -15 -2 Q-8 -3 0 2 Z"
          fill="#ffffff"
          stroke="#55606b"
          strokeWidth="0.8"
        />
        <path d="M0 0 Q6 -7 15 -2 Q8 -3 0 2 Z" fill="#ffffff" stroke="#55606b" strokeWidth="0.8" />
        <path d="M-15 -2 L-12 -3 M15 -2 L12 -3" stroke="#2b3440" strokeWidth="1.4" />
      </g>
      <ellipse cx="0" cy="1" rx="4" ry="2" fill="#ffffff" stroke="#55606b" strokeWidth="0.6" />
      <path d="M3.5 0.5 L6 1 L3.5 1.6 Z" fill="#f5a524" />
    </svg>
  );
}

/** A diamond kite with a bow-tied tail, bobbing in the breeze. */
function Kite() {
  return (
    <svg
      className="sz-kite"
      data-testid="seasonal-kite"
      viewBox="0 0 70 110"
      width="58"
      height="92"
    >
      <path d="M35 2 L58 30 L35 62 L12 30 Z" fill="#e5484d" />
      <path d="M35 2 L58 30 L35 30 Z" fill="#f5c542" />
      <path d="M35 30 L12 30 L35 62 Z" fill="#3e8ef7" />
      <path d="M35 2 V62 M12 30 H58" stroke="#7a1d1d" strokeWidth="1.2" />
      <path
        className="sz-kite-tail"
        d="M35 62 Q28 72 36 80 T34 98 T38 108"
        stroke="#55606b"
        strokeWidth="1.2"
        fill="none"
      />
      {[
        [31, 72, '#f472b6'],
        [37, 86, '#30a46c'],
        [34, 100, '#f5c542'],
      ].map(([x, y, c], i) => (
        <path key={i} d={`M${x} ${y} l-5 -3 v6 Z M${x} ${y} l5 -3 v6 Z`} fill={c as string} />
      ))}
    </svg>
  );
}

/** Summer's beach along the bottom: sand, an umbrella, a bouncing ball, a
 * sandcastle and a palm tree (a silhouette at night). */
function Beach({ night }: { night: boolean }) {
  return (
    <div className="sz-ground h-56" data-testid="seasonal-beach">
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-14"
        viewBox="0 0 400 50"
        preserveAspectRatio="none"
      >
        <path
          d="M0 22 Q60 10 130 18 T260 14 T400 20 V50 H0 Z"
          fill={night ? '#7d6f58' : '#f1dca8'}
        />
        <path d="M0 32 Q80 24 170 30 T400 28 V50 H0 Z" fill={night ? '#6f624d' : '#e8cd8f'} />
      </svg>
      {!night && (
        <>
          <svg
            className="absolute bottom-6 left-[5%]"
            data-testid="seasonal-umbrella"
            viewBox="0 0 120 120"
            width="120"
            height="120"
          >
            <path d="M60 30 L72 116" stroke="#8a6a46" strokeWidth="3" />
            <path d="M8 46 Q60 -6 112 46 Z" fill="#ffffff" />
            {[0, 2, 4].map((k) => (
              <path
                key={k}
                d={`M60 20 L${8 + k * 20.8} 46 Q${18.4 + k * 20.8} 40 ${28.8 + k * 20.8} 46 Z`}
                fill="#e5484d"
              />
            ))}
            <path
              d="M8 46 Q18 40 28 46 Q39 40 49 46 Q60 40 70 46 Q81 40 91 46 Q102 40 112 46"
              fill="none"
              stroke="#c43a3f"
              strokeWidth="1.2"
            />
            <circle cx="60" cy="19" r="3" fill="#c43a3f" />
          </svg>
          <div className="sz-ball-bounce" style={{ left: '15%' }}>
            <svg className="sz-ball" viewBox="-12 -12 24 24" width="30" height="30">
              <circle r="11" fill="#ffffff" stroke="#c9ced6" strokeWidth="0.6" />
              <path d="M0 -11 A11 11 0 0 1 11 0 L0 0 Z" fill="#e5484d" />
              <path d="M0 11 A11 11 0 0 1 -11 0 L0 0 Z" fill="#3e8ef7" />
              <path d="M11 0 A11 11 0 0 1 0 11 L0 0 Z" fill="#f5c542" />
              <circle r="2.4" fill="#ffffff" />
            </svg>
          </div>
          <svg className="absolute bottom-5 left-[22%]" viewBox="0 0 70 60" width="70" height="60">
            <path
              d="M6 58 V34 H16 V28 H22 V34 H30 V22 H40 V34 H48 V28 H54 V34 H64 V58 Z"
              fill="#e2c27d"
            />
            <path d="M32 30 h6 v8 h-6 z" fill="#c9a660" />
            <path d="M35 22 V6" stroke="#55606b" strokeWidth="1.2" />
            <path className="sz-flag-wave" d="M35 6 L47 10 L35 14 Z" fill="#e5484d" />
          </svg>
        </>
      )}
      <Palm night={night} />
    </div>
  );
}

function Palm({ night }: { night: boolean }) {
  const leaf = night ? '#1e2b26' : '#2f8a4a';
  const leafLight = night ? '#26352f' : '#3fa35a';
  const trunk = night ? '#2a2420' : '#8a6239';
  return (
    <svg
      className="absolute bottom-4 right-[2%]"
      data-testid="seasonal-palm"
      viewBox="0 0 160 220"
      width="150"
      height="206"
    >
      <path
        d="M86 216 C82 170 90 120 78 72"
        stroke={trunk}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
      />
      {range(9).map((i) => (
        <path
          key={i}
          d={`M${88 - i * 1} ${210 - i * 16} q-7 -3 -13 0`}
          stroke={night ? '#1a1512' : '#6e4c2b'}
          strokeWidth="2"
          fill="none"
        />
      ))}
      <g className="sz-fronds" style={{ transformOrigin: '78px 72px' }}>
        {[
          'M78 72 C50 50 22 58 4 82 C30 66 52 66 78 76 Z',
          'M78 72 C58 36 30 26 12 32 C40 38 60 52 78 74 Z',
          'M78 72 C76 38 92 14 112 6 C98 26 88 46 80 74 Z',
          'M78 72 C104 46 132 48 154 66 C126 58 104 62 80 76 Z',
          'M78 72 C110 66 138 84 150 108 C126 88 104 80 80 76 Z',
          'M78 72 C64 84 50 104 46 128 C58 104 68 92 80 76 Z',
        ].map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? leafLight : leaf} />
        ))}
        {!night && (
          <>
            <circle cx="74" cy="78" r="5" fill="#6b4a2f" />
            <circle cx="83" cy="80" r="5" fill="#5a3e27" />
          </>
        )}
      </g>
    </svg>
  );
}
