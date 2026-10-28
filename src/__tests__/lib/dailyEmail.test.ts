import { describe, it, expect } from 'vitest';
import {
  CATCH_UP_MINUTES,
  isDue,
  isValidTimeZone,
  localClock,
  parseSendTime,
  shiftDate,
} from '@/lib/dailyEmail/schedule';
import { buildDigest, pickDailyOutfit } from '@/lib/dailyEmail/digest';
import type { DailyForecast, DigestInput } from '@/lib/dailyEmail/digest';
import { emailColors, forecastLine, renderDailyEmail, weatherTip } from '@/lib/dailyEmail/render';
import { NEUTRAL_ACCENT, themeFromOutfit } from '@/lib/outfitTheme';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';
const mild: DailyForecast = {
  high: 70,
  low: 55,
  rainChance: 0,
  condition: 'Clear',
  description: 'clear sky',
};

function input(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    items: [],
    recentWears: [],
    ratedOutfits: [],
    likedCombinations: [],
    model: null,
    forecast: mild,
    today: '2026-10-13',
    ...overrides,
  };
}

describe('schedule', () => {
  // 12:30 UTC is 08:30 in New York (EDT) and 05:30 in Los Angeles (PDT).
  const now = new Date('2026-10-13T12:30:00Z');

  it('reads the local date and time in a zone', () => {
    expect(localClock(now, 'America/New_York')).toEqual({ date: '2026-10-13', minutes: 510 });
    expect(localClock(new Date('2026-10-13T03:00:00Z'), 'America/Los_Angeles').date).toBe(
      '2026-10-12',
    );
  });

  it('falls back to UTC for a missing or unknown zone', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(localClock(now, 'Mars/Olympus')).toEqual({ date: '2026-10-13', minutes: 750 });
  });

  it('parses Postgres time values', () => {
    expect(parseSendTime('07:30')).toBe(450);
    expect(parseSendTime('07:30:00')).toBe(450);
    expect(parseSendTime('24:00')).toBeNull();
    expect(parseSendTime(null)).toBeNull();
  });

  it('shifts dates across month ends', () => {
    expect(shiftDate('2026-10-03', -6)).toBe('2026-09-27');
  });

  it('is due once the local send time passes', () => {
    const base = { now, sendTime: '08:00', lastSentDate: null };
    expect(isDue({ ...base, timeZone: 'America/New_York' })).toEqual({
      due: true,
      localDate: '2026-10-13',
    });
    // Still 05:30 in Los Angeles.
    expect(isDue({ ...base, timeZone: 'America/Los_Angeles' }).due).toBe(false);
  });

  it('sends once per local day', () => {
    expect(
      isDue({ now, timeZone: 'America/New_York', sendTime: '08:00', lastSentDate: '2026-10-13' })
        .due,
    ).toBe(false);
  });

  it("doesn't send a morning email late in the day", () => {
    const late = new Date(now.getTime() + CATCH_UP_MINUTES * 60_000);
    expect(
      isDue({ now: late, timeZone: 'America/New_York', sendTime: '08:00', lastSentDate: null }).due,
    ).toBe(false);
  });
});

describe('digest', () => {
  it('picks the highest-scoring clean outfit for the weather', () => {
    const tee = makeTop({ type: 'T-Shirt' });
    const hoodie = makeTop({ type: 'Hoodie' });
    const dirtyTee = makeTop({ type: 'T-Shirt', is_dirty: true });
    const jeans = makeBottom();
    const shoes = makeShoes();
    const hot = { ...mild, high: 95, low: 80 };
    const pick = pickDailyOutfit(
      input({ items: [hoodie, dirtyTee, tee, jeans, shoes], forecast: hot }),
      'hot',
    );
    // Hoodies are blocked in hot weather and dirty items never appear.
    expect(pick?.top.id).toBe(tee.id);
  });

  it('rotates equally good outfits by day, and keeps one pick per day', () => {
    const items = [
      makeTop({ colors: ['red'] }),
      makeTop({ colors: ['green'] }),
      makeTop({ colors: ['white'] }),
      makeBottom(),
      makeBottom({ colors: ['black'] }),
      makeShoes(),
    ];
    const pickOn = (today: string) => {
      const p = pickDailyOutfit(input({ items, today }), null);
      return `${p?.top.id}|${p?.bottom.id}`;
    };
    expect(pickOn('2026-10-13')).toBe(pickOn('2026-10-13'));
    const week = Array.from({ length: 7 }, (_, d) => pickOn(`2026-10-1${d}`));
    expect(new Set(week).size).toBeGreaterThan(2);
  });

  it('returns no outfit when a slot is empty', () => {
    expect(pickDailyOutfit(input({ items: [makeTop(), makeBottom()] }), 'warm')).toBeNull();
  });

  it('sends just the outfit and the temperature', () => {
    const digest = buildDigest(input({ items: [makeTop(), makeBottom(), makeShoes(), makeTop()] }));
    expect(Object.keys(digest).sort()).toEqual(['outfit', 'temperature']);
  });

  it('uses the forecast high and custom thresholds', () => {
    const digest = buildDigest(
      input({ forecast: { ...mild, high: 60 }, thresholds: { cold: 40, cool: 55, warm: 75 } }),
    );
    expect(digest.temperature).toBe('warm');
    expect(buildDigest(input({ forecast: null })).temperature).toBeNull();
  });
});

describe('render', () => {
  const top = makeTop({ colors: ['red'] });
  const bottom = makeBottom();
  const shoes = makeShoes();
  const base = {
    date: '2026-10-13',
    imageUrls: { [top.id]: 'https://img.example/top.png?token=a&b=1' },
    appUrl: 'https://fitfinder.example',
    unsubscribeUrl: 'https://fitfinder.example/api/email/unsubscribe?token=abc',
  };

  it('describes the weather', () => {
    expect(forecastLine(mild)).toBe('High 70° · Low 55° · clear sky');
    expect(forecastLine({ ...mild, rainChance: 0.7 })).toBe(
      'High 70° · Low 55° · 70% chance of rain',
    );
    expect(weatherTip({ ...mild, rainChance: 0.6 })).toMatch(/umbrella/);
    expect(weatherTip({ ...mild, high: 80, low: 50 })).toMatch(/Layer/);
    expect(weatherTip(mild)).toBeNull();
  });

  it('renders the outfit and links', () => {
    const email = renderDailyEmail({
      ...base,
      forecast: mild,
      digest: {
        outfit: { top, bottom, shoes },
        temperature: 'warm',
      },
    });
    expect(email.subject).toBe("Today's fit: Red T-Shirt + Navy blue Jeans · 70°");
    expect(email.html).toContain('Tuesday, October 13');
    expect(email.html).toContain('src="https://img.example/top.png?token=a&amp;b=1"');
    expect(email.html).toContain('aria-label="Navy blue Jeans"');
    expect(email.html).toContain(base.unsubscribeUrl);
    expect(email.html).not.toContain('Not worn this week');
    expect(email.text).toContain('Top: Red T-Shirt');
    expect(email.text).not.toContain('NOT WORN');
    expect(email.text).toContain(`Unsubscribe: ${base.unsubscribeUrl}`);
  });

  it('handles no forecast and no outfit', () => {
    const email = renderDailyEmail({
      ...base,
      forecast: null,
      digest: { outfit: null, temperature: null },
    });
    expect(email.subject).toBe('Your FitFinder morning, Tuesday, October 13');
    expect(email.text).toContain('Add your ZIP code');
    expect(email.html).not.toContain('Not worn this week');
  });

  it('colours the email from the outfit it recommends, top first', () => {
    const email = renderDailyEmail({
      ...base,
      forecast: mild,
      digest: { outfit: { top, bottom, shoes }, temperature: 'warm' },
    });
    const theme = themeFromOutfit(top.colors[0], bottom.colors[0], shoes.colors[0]);
    expect(emailColors({ top, bottom, shoes }).accent).toBe(theme.uiAccent);
    // The banner is the top's colour; the button and headings the accent.
    expect(email.html).toContain(`background:${theme.posterBg};border-radius:18px`);
    expect(email.html).toContain(`background:${theme.uiAccent};border-radius:999px`);
    expect(email.html).not.toContain('#5c1a26');
  });

  it('uses the neutral fog & slate colours when there is no outfit', () => {
    expect(emailColors(null).accent).toBe(NEUTRAL_ACCENT);
    const email = renderDailyEmail({
      ...base,
      forecast: null,
      digest: { outfit: null, temperature: null },
    });
    expect(email.html).toContain(`background:${NEUTRAL_ACCENT};border-radius:999px`);
  });

  it('escapes item text', () => {
    const odd = makeTop({ type: '<script>' });
    const email = renderDailyEmail({
      ...base,
      forecast: mild,
      digest: { outfit: { top: odd, bottom, shoes }, temperature: 'warm' },
    });
    expect(email.html).not.toContain('<script>');
  });

  it("opens the Outfits screen on the email's outfit", () => {
    const email = renderDailyEmail({
      ...base,
      forecast: mild,
      digest: { outfit: { top, bottom, shoes }, temperature: 'warm' },
    });
    const link = `${base.appUrl}/?top=${top.id}&amp;bottom=${bottom.id}&amp;shoes=${shoes.id}`;
    expect(email.html).toContain(`href="${link}"`);
    expect(email.text).toContain(
      `Open FitFinder: ${base.appUrl}/?top=${top.id}&bottom=${bottom.id}&shoes=${shoes.id}`,
    );
  });

  it('opens the app itself when there is no outfit', () => {
    const email = renderDailyEmail({
      ...base,
      forecast: null,
      digest: { outfit: null, temperature: null },
    });
    expect(email.html).toContain(`href="${base.appUrl}"`);
  });
});
