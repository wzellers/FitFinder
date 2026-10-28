'use client';

import React, { useMemo } from 'react';
import type { SceneChoice } from '@/lib/weatherScene';

/** A repeatable pseudo-random number in [0, 1) for particle `i`, so the
 * layout is the same on every render. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const COUNTS = { stars: 40, clouds: 7, rain: 110, snow: 60 } as const;
/** Raindrops splashing on the ground, as small rings. */
const SPLASHES = 18;

/**
 * A soft animated sky behind the Outfits screen that matches today's
 * weather: a drifting sun glow (or twinkling stars at night), slow clouds,
 * fine rain (with the odd flash in a storm) or falling snow. Decorative and
 * behind everything; users who prefer reduced motion get it still.
 */
export default function WeatherBackdrop({ scene, night, storm }: SceneChoice) {
  const particles = useMemo(() => {
    const n =
      scene === 'rainy'
        ? COUNTS.rain
        : scene === 'snowy'
          ? COUNTS.snow
          : scene === 'cloudy'
            ? COUNTS.clouds
            : night
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
  }, [scene, night]);

  return (
    <div
      aria-hidden="true"
      data-testid="weather-backdrop"
      data-scene={night && scene === 'sunny' ? 'night' : scene}
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      <div className={`wx-sky wx-sky-${night && scene === 'sunny' ? 'night' : scene}`} />
      {scene === 'sunny' && !night && <div className="wx-sun" />}

      {scene === 'sunny' &&
        night &&
        particles.map((p, i) => (
          <span
            key={i}
            className="wx-star"
            style={{
              left: `${p.x}%`,
              top: `${p.y * 0.7}%`,
              width: 2 + p.size * 2,
              height: 2 + p.size * 2,
              animationDelay: `${-p.delay * 4}s`,
              animationDuration: `${3 + p.speed * 3}s`,
            }}
          />
        ))}

      {scene === 'cloudy' &&
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

      {scene === 'rainy' &&
        particles.map((p, i) => {
          // Two depths: near drops are longer, brighter and faster.
          const near = i % 3 === 0;
          return (
            <span
              key={i}
              className={near ? 'wx-drop wx-drop-near' : 'wx-drop'}
              style={{
                left: `${p.x * 1.1 - 5}%`,
                height: near ? 90 + p.size * 60 : 45 + p.size * 35,
                animationDelay: `${-p.delay * 2}s`,
                animationDuration: `${near ? 0.55 + p.speed * 0.25 : 0.95 + p.speed * 0.5}s`,
              }}
            />
          );
        })}
      {scene === 'rainy' &&
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
      {scene === 'rainy' && storm && <div className="wx-flash" data-testid="weather-flash" />}

      {scene === 'snowy' &&
        particles.map((p, i) => (
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
        ))}
    </div>
  );
}
