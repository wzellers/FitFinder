'use client';

import React, { useMemo } from 'react';
import type { SceneChoice, Season } from '@/lib/weatherScene';

/** A repeatable pseudo-random number in [0, 1) for particle `i`, so the
 * layout is the same on every render. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const COUNTS = { stars: 90, clouds: 7, rain: 110, storm: 170, snow: 70 } as const;
/** Raindrops splashing on the ground, as small rings. */
const SPLASHES = 18;
/** Every n-th star is a bright one, with a glow and a sparkle. */
const BRIGHT_STAR_EVERY = 7;
/** Every n-th snowflake is a detailed crystal; the rest are soft dots. */
const CRYSTAL_EVERY = 3;

interface WeatherProps extends SceneChoice {
  /** A seasonal touch, e.g. a Christmas tree in December. */
  season?: Season | null;
}

/** Which sky colour the scene uses. */
const skyKey = ({ scene, night, storm }: SceneChoice) =>
  scene === 'sunny' && night ? 'night' : scene === 'rainy' && storm ? 'storm' : scene;

/**
 * The animated weather behind the whole Outfits screen: a sky tint, a sun
 * glow or a starry night, slow clouds, rain (with lightning in a storm) or
 * snow (with a snowman), and seasonal touches. Decorative and behind
 * everything; users who prefer reduced motion get it still.
 */
export default function WeatherBackdrop({ scene, night, storm, season = null }: WeatherProps) {
  const key = skyKey({ scene, night, storm });
  const particles = useMemo(() => {
    const n =
      key === 'storm'
        ? COUNTS.storm
        : key === 'rainy'
          ? COUNTS.rain
          : key === 'snowy'
            ? COUNTS.snow
            : key === 'cloudy'
              ? COUNTS.clouds
              : key === 'night'
                ? COUNTS.stars
                : 0;
    // x and y are percentages of the screen (0–100).
    return Array.from({ length: n }, (_, i) => ({
      x: rand(i, 1) * 100,
      y: rand(i, 2) * 100,
      size: rand(i, 3),
      delay: rand(i, 4),
      speed: rand(i, 5),
    }));
  }, [key]);

  return (
    <div
      aria-hidden="true"
      data-testid="weather-backdrop"
      data-scene={key === 'storm' ? 'rainy' : key}
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      <div className={`wx-sky wx-sky-${key}`} />
      {key === 'sunny' && <div className="wx-sun" />}

      {key === 'night' && (
        <>
          {particles.map((p, i) => {
            const bright = i % BRIGHT_STAR_EVERY === 0;
            const size = bright ? 3 + p.size * 2 : 1.5 + p.size * 2;
            return (
              <span
                key={i}
                className={bright ? 'wx-star wx-star-bright' : 'wx-star'}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y * 0.8}%`,
                  width: size,
                  height: size,
                  animationDelay: `${-p.delay * 4}s`,
                  animationDuration: `${2.5 + p.speed * 3}s`,
                }}
              />
            );
          })}
          <span className="wx-shooting" style={{ top: '12%', left: '62%' }} />
          <span
            className="wx-shooting"
            style={{ top: '26%', left: '28%', animationDelay: '-6.5s' }}
          />
        </>
      )}

      {key === 'cloudy' &&
        particles.map((p, i) => (
          <span
            key={i}
            className="wx-cloud"
            style={{
              top: `${5 + p.y * 0.55}%`,
              width: 280 + p.size * 260,
              height: 110 + p.size * 90,
              animationDelay: `${-p.delay * 60}s`,
              animationDuration: `${45 + p.speed * 35}s`,
            }}
          />
        ))}

      {(key === 'rainy' || key === 'storm') &&
        particles.map((p, i) => {
          // Two depths: near drops are longer, brighter and faster.
          const near = i % 3 === 0;
          const fast = key === 'storm' ? 0.7 : 1;
          return (
            <span
              key={i}
              className={`wx-drop${near ? ' wx-drop-near' : ''}${key === 'storm' ? ' wx-drop-storm' : ''}`}
              style={{
                left: `${p.x * 1.1 - 5}%`,
                height: near ? 90 + p.size * 60 : 45 + p.size * 35,
                animationDelay: `${-p.delay * 2}s`,
                animationDuration: `${(near ? 0.55 + p.speed * 0.25 : 0.95 + p.speed * 0.5) * fast}s`,
              }}
            />
          );
        })}
      {(key === 'rainy' || key === 'storm') &&
        particles.slice(0, SPLASHES).map((p, i) => (
          <span
            key={`splash-${i}`}
            className="wx-splash"
            style={{
              left: `${p.x}%`,
              bottom: `${2 + p.y * 0.14}%`,
              animationDelay: `${-p.delay * 1.6}s`,
              animationDuration: `${1.2 + p.speed * 0.8}s`,
            }}
          />
        ))}
      {key === 'storm' && (
        <>
          <div className="wx-flash" data-testid="weather-flash" />
          <Bolt className="wx-bolt" style={{ left: '14%' }} />
          <Bolt className="wx-bolt wx-bolt-late" style={{ left: '74%' }} />
        </>
      )}

      {key === 'snowy' && (
        <>
          {particles.map((p, i) =>
            i % CRYSTAL_EVERY === 0 ? (
              <Snowflake
                key={i}
                className="wx-crystal"
                size={12 + p.size * 14}
                style={{
                  left: `${p.x}%`,
                  animationDelay: `${-p.delay * 16}s`,
                  animationDuration: `${11 + p.speed * 9}s`,
                }}
              />
            ) : (
              <span
                key={i}
                className="wx-flake"
                style={{
                  left: `${p.x}%`,
                  width: 3 + p.size * 5,
                  height: 3 + p.size * 5,
                  animationDelay: `${-p.delay * 14}s`,
                  animationDuration: `${9 + p.speed * 8}s`,
                }}
              />
            ),
          )}
          <div className="wx-snowbank" />
          <Snowman />
        </>
      )}

      {season === 'christmas' && <ChristmasTree />}
    </div>
  );
}

/** Clouds drifting through the sky strip, by scene. */
const STRIP_CLOUDS: Record<
  string,
  { top: number; scale: number; delay: number; duration: number }[]
> = {
  sunny: [
    { top: 10, scale: 0.75, delay: 6, duration: 46 },
    { top: 40, scale: 0.55, delay: 24, duration: 60 },
    { top: 20, scale: 0.6, delay: 40, duration: 54 },
  ],
  cloudy: [
    { top: 6, scale: 0.95, delay: 4, duration: 50 },
    { top: 34, scale: 0.7, delay: 18, duration: 62 },
    { top: 14, scale: 0.85, delay: 30, duration: 56 },
    { top: 40, scale: 0.6, delay: 44, duration: 70 },
    { top: 2, scale: 0.7, delay: 58, duration: 64 },
  ],
  rainy: [
    { top: 4, scale: 1, delay: 4, duration: 48 },
    { top: 30, scale: 0.8, delay: 16, duration: 58 },
    { top: 10, scale: 0.9, delay: 28, duration: 52 },
    { top: 36, scale: 0.7, delay: 40, duration: 66 },
    { top: 0, scale: 0.85, delay: 52, duration: 60 },
  ],
  snowy: [
    { top: 6, scale: 0.9, delay: 6, duration: 58 },
    { top: 32, scale: 0.7, delay: 22, duration: 70 },
    { top: 12, scale: 0.8, delay: 38, duration: 64 },
    { top: 2, scale: 0.65, delay: 52, duration: 76 },
  ],
};

/** Christmas light colours, in order along the string. */
const BULBS = ['#e5484d', '#30a46c', '#f5c542', '#3e8ef7', '#e93d82'];
const BULB_COUNT = 18;
/** How far the light string sags at `x` (0–1 across), in px from the top. */
const sag = (x: number) => 6 + 10 * Math.abs(Math.sin(x * Math.PI * 3));

/**
 * The sky just above the "Today's fit" banner: the sun, the moon or clouds
 * for today's weather, drifting partly behind the banner, plus seasonal
 * lights. Keeps the weather out of the banner, which takes the outfit's
 * colours.
 */
export function WeatherSky({ scene, night, storm, season = null }: WeatherProps) {
  const key = skyKey({ scene, night, storm });
  const clouds = STRIP_CLOUDS[key === 'storm' ? 'rainy' : key] ?? [];
  const puffClass =
    key === 'storm'
      ? 'wx-puff wx-puff-storm'
      : key === 'rainy'
        ? 'wx-puff wx-puff-rain'
        : key === 'snowy'
          ? 'wx-puff wx-puff-snow'
          : key === 'cloudy'
            ? 'wx-puff wx-puff-grey'
            : 'wx-puff';
  return (
    <div
      aria-hidden="true"
      data-testid="weather-sky"
      className={`absolute inset-x-0 -top-2 h-28 pointer-events-none overflow-hidden ${key === 'storm' ? 'wx-strip-storm' : ''}`}
    >
      {key === 'sunny' && (
        <div className="wx-sun-disc" data-testid="weather-sun">
          <span className="wx-sun-rays" />
        </div>
      )}
      {key === 'night' && <div className="wx-moon" data-testid="weather-moon" />}
      {clouds.map((c, i) => (
        <span
          key={i}
          className={key === 'cloudy' && i % 2 === 1 ? 'wx-puff' : puffClass}
          data-testid="weather-cloud"
          style={
            {
              top: `${c.top}%`,
              '--puff-scale': c.scale,
              animationDelay: `${-c.delay}s`,
              animationDuration: `${c.duration}s`,
            } as React.CSSProperties
          }
        />
      ))}
      {season === 'christmas' && (
        <div className="absolute inset-x-0 top-0 h-8" data-testid="weather-lights">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
          >
            <path
              d={Array.from({ length: 61 }, (_, i) => {
                const x = i / 60;
                return `${i ? 'L' : 'M'}${x * 100} ${sag(x)}`;
              }).join(' ')}
              fill="none"
              stroke="#2f3a2f"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {Array.from({ length: BULB_COUNT }, (_, i) => {
            const x = (i + 0.5) / BULB_COUNT;
            return (
              <span
                key={i}
                className="wx-bulb"
                style={{
                  left: `${x * 100}%`,
                  top: sag(x) - 1,
                  color: BULBS[i % BULBS.length],
                  animationDelay: `${-(i % 5) * 0.4}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bolt({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      data-testid="weather-bolt"
      viewBox="0 0 60 220"
      width="60"
      height="220"
    >
      <path
        d="M34 0 L18 86 L32 88 L12 160 L28 162 L8 220 L46 132 L30 130 L50 70 L36 68 L52 0 Z"
        fill="#fff8d6"
      />
    </svg>
  );
}

function Snowflake({
  className,
  size,
  style,
}: {
  className: string;
  size: number;
  style: React.CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="-12 -12 24 24" width={size} height={size}>
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
        {[0, 60, 120].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 -11 V11" />
            <path d="M-3 -8 L0 -5 L3 -8 M-3 8 L0 5 L3 8" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Snowman() {
  return (
    <svg
      className="wx-snowman"
      data-testid="weather-snowman"
      viewBox="0 0 120 160"
      width="120"
      height="160"
    >
      {/* Stick arms */}
      <g stroke="#6b4a2f" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M38 80 L10 64 M18 69 L12 58" />
        <path d="M82 80 L110 62 M102 67 L108 56" />
      </g>
      {/* Body */}
      <g fill="#ffffff" stroke="#c9dcef" strokeWidth="2">
        <circle cx="60" cy="126" r="32" />
        <circle cx="60" cy="80" r="24" />
        <circle cx="60" cy="44" r="18" />
      </g>
      {/* Buttons, eyes, smile */}
      <g fill="#2b3440">
        <circle cx="60" cy="72" r="2.6" />
        <circle cx="60" cy="84" r="2.6" />
        <circle cx="60" cy="118" r="3" />
        <circle cx="53" cy="40" r="2.2" />
        <circle cx="67" cy="40" r="2.2" />
        {[50, 55, 60, 65, 70].map((x, i) => (
          <circle key={x} cx={x} cy={i === 0 || i === 4 ? 49 : 51} r="1.2" />
        ))}
      </g>
      {/* Carrot nose */}
      <path d="M60 44 L78 47 L60 48 Z" fill="#f08a24" />
      {/* Scarf */}
      <path d="M42 58 Q60 66 78 58 L78 64 Q60 72 42 64 Z" fill="#d6404a" />
      <path d="M70 62 L76 82 L69 83 L64 64 Z" fill="#b8323b" />
      {/* Hat */}
      <rect x="40" y="26" width="40" height="5" rx="2" fill="#2b3440" />
      <rect x="47" y="6" width="26" height="22" rx="2" fill="#2b3440" />
      <rect x="47" y="21" width="26" height="4" fill="#d6404a" />
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
      data-testid="weather-tree"
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
