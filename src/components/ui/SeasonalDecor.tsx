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
          <Falling count={26} className="sz-petal" colors={PETALS} spin />
          <FlowerRow />
          <Butterfly />
        </>
      )}

      {theme === 'summer' &&
        (night ? (
          range(22).map((i) => (
            <span
              key={i}
              className="sz-firefly"
              style={{
                left: `${rand(i, 1) * 100}%`,
                top: `${30 + rand(i, 2) * 65}%`,
                animationDelay: `${-rand(i, 4) * 8}s, ${-rand(i, 6) * 3}s`,
              }}
            />
          ))
        ) : (
          <div className="sz-shimmer" />
        ))}

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

      {theme === 'easter' && <EasterGrass />}
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
      {theme === 'summer' && sun && <Sunglasses />}
      {theme === 'summer' &&
        !night &&
        range(2).map((i) => (
          <svg
            key={i}
            className="sz-drift sz-gull"
            viewBox="0 0 24 8"
            width="30"
            height="10"
            style={{
              top: `${20 + i * 30}%`,
              animationDelay: `${-i * 20}s`,
              animationDuration: '40s',
            }}
          >
            <path
              d="M1 6 Q6 0 12 6 Q18 0 23 6"
              fill="none"
              stroke="#3b4652"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
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

function FlowerRow() {
  return (
    <svg
      className="sz-ground"
      data-testid="seasonal-flowers"
      viewBox="0 0 400 40"
      preserveAspectRatio="xMidYMax slice"
      width="100%"
      height="56"
    >
      {range(22).map((i) => {
        const x = 8 + i * 18 + rand(i, 1) * 6;
        const h = 14 + rand(i, 2) * 14;
        const c = PASTELS[i % PASTELS.length];
        return (
          <g key={i} className="sz-sway" style={{ transformOrigin: `${x}px 40px` }}>
            <path d={`M${x} 40 V${40 - h}`} stroke="#4f8a3a" strokeWidth="1.6" />
            {range(5).map((p) => (
              <circle
                key={p}
                cx={x + 3.2 * Math.cos((p * 2 * Math.PI) / 5)}
                cy={40 - h + 3.2 * Math.sin((p * 2 * Math.PI) / 5)}
                r="2.6"
                fill={c}
              />
            ))}
            <circle cx={x} cy={40 - h} r="1.8" fill="#f5c542" />
          </g>
        );
      })}
    </svg>
  );
}

function Butterfly() {
  return (
    <div className="sz-butterfly-path" data-testid="seasonal-butterfly">
      <svg className="sz-butterfly" viewBox="-12 -10 24 20" width="34" height="28">
        <g className="sz-wing">
          <path d="M0 0 C-4 -9 -12 -9 -11 -2 C-10 3 -4 3 0 0 Z" fill="#8e4ec6" />
          <path d="M0 0 C-3 4 -9 8 -8 3 Z" fill="#c084fc" />
        </g>
        <g className="sz-wing sz-wing-right">
          <path d="M0 0 C4 -9 12 -9 11 -2 C10 3 4 3 0 0 Z" fill="#8e4ec6" />
          <path d="M0 0 C3 4 9 8 8 3 Z" fill="#c084fc" />
        </g>
        <path d="M0 -5 V6" stroke="#2b3440" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function EasterGrass() {
  return (
    <svg
      className="sz-ground"
      data-testid="seasonal-eggs"
      viewBox="0 0 400 50"
      preserveAspectRatio="xMidYMax slice"
      width="100%"
      height="70"
    >
      <path
        d={`M0 50 ${range(81)
          .map((i) => `L${i * 5} ${i % 2 ? 30 + rand(i, 1) * 8 : 40}`)
          .join(' ')} L400 50 Z`}
        fill="#7cc46a"
      />
      {range(7).map((i) => {
        const x = 30 + i * 55 + rand(i, 1) * 20;
        const c = PASTELS[i % PASTELS.length];
        return (
          <g key={i} transform={`translate(${x} 38) rotate(${(rand(i, 2) - 0.5) * 30})`}>
            <ellipse rx="8" ry="10.5" fill={c} stroke="rgba(0,0,0,0.08)" />
            <path
              d="M-8 0 L-5 -3 L-2 0 L1 -3 L4 0 L8 -3"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.6"
            />
            <path d="M-7 4 H7" stroke={PASTELS[(i + 2) % PASTELS.length]} strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

function Vine({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      className={`sz-vine sz-vine-${side}`}
      data-testid="seasonal-vine"
      viewBox="0 0 80 300"
      width="90"
      height="320"
    >
      <path
        className="sz-vine-stem"
        d="M40 300 C10 250 70 210 40 160 C10 110 70 70 40 10"
        fill="none"
        stroke="#3f7d3a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {range(9).map((i) => {
        const y = 280 - i * 31;
        const x = 40 + (i % 2 ? 18 : -18) * Math.sin((y / 300) * Math.PI);
        return (
          <path
            key={i}
            className="sz-vine-leaf"
            style={{ animationDelay: `${0.3 + i * 0.25}s` }}
            d={`M${x} ${y} c${i % 2 ? 10 : -10} -8 ${i % 2 ? 16 : -16} 2 0 8 Z`}
            fill="#5aa64a"
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
  return (
    <svg
      className="absolute inset-x-0 top-0 w-full"
      data-testid="seasonal-icicles"
      viewBox="0 0 400 30"
      preserveAspectRatio="none"
      height="30"
    >
      <path
        d={`M0 0 ${range(41)
          .map((i) => `L${i * 10 + 5} ${i % 3 === 0 ? 26 : 10 + rand(i, 1) * 10} L${i * 10 + 10} 2`)
          .join(' ')} L400 0 Z`}
        fill="rgba(225, 240, 252, 0.9)"
        stroke="rgba(160, 200, 235, 0.8)"
        strokeWidth="0.6"
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
      viewBox="0 0 60 20"
      width="60"
      height="20"
    >
      <path d="M2 4 H58" stroke="#1f2328" strokeWidth="2.5" />
      <path d="M6 4 H26 Q26 18 16 18 Q6 18 6 4 Z" fill="#1f2328" />
      <path d="M34 4 H54 Q54 18 44 18 Q34 18 34 4 Z" fill="#1f2328" />
      <path d="M10 7 L14 7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
    </svg>
  );
}
