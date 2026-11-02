import { describe, it, expect } from 'vitest';
import {
  SEASONAL_THEMES,
  easterSunday,
  hanukkahNight,
  holidayFor,
  seasonFor,
  seasonalTheme,
  thanksgiving,
} from '@/lib/seasons';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe('seasons', () => {
  it('has a season for every month', () => {
    expect(seasonFor(day(2026, 1, 15))).toBe('winter');
    expect(seasonFor(day(2026, 2, 28))).toBe('winter');
    expect(seasonFor(day(2026, 3, 1))).toBe('spring');
    expect(seasonFor(day(2026, 5, 31))).toBe('spring');
    expect(seasonFor(day(2026, 6, 1))).toBe('summer');
    expect(seasonFor(day(2026, 8, 31))).toBe('summer');
    expect(seasonFor(day(2026, 9, 1))).toBe('fall');
    expect(seasonFor(day(2026, 11, 30))).toBe('fall');
    expect(seasonFor(day(2026, 12, 1))).toBe('winter');
  });

  it('always shows something: every day of the year has a theme', () => {
    for (
      let d = day(2026, 1, 1);
      d.getFullYear() === 2026;
      d = day(2026, d.getMonth() + 1, d.getDate() + 1)
    ) {
      expect(SEASONAL_THEMES.map((t) => t.theme)).toContain(seasonalTheme(d));
    }
  });

  it('works out Easter', () => {
    expect(ymd(easterSunday(2025))).toEqual([2025, 4, 20]);
    expect(ymd(easterSunday(2026))).toEqual([2026, 4, 5]);
    expect(ymd(easterSunday(2027))).toEqual([2027, 3, 28]);
    expect(ymd(easterSunday(2028))).toEqual([2028, 4, 16]);
  });

  it('works out Thanksgiving, the fourth Thursday of November', () => {
    expect(ymd(thanksgiving(2025))).toEqual([2025, 11, 27]);
    expect(ymd(thanksgiving(2026))).toEqual([2026, 11, 26]);
    expect(ymd(thanksgiving(2027))).toEqual([2027, 11, 25]);
  });

  it('counts the nights of Hanukkah', () => {
    expect(hanukkahNight(day(2026, 12, 3))).toBeNull();
    expect(hanukkahNight(day(2026, 12, 4))).toBe(1);
    expect(hanukkahNight(day(2026, 12, 11))).toBe(8);
    expect(hanukkahNight(day(2026, 12, 12))).toBeNull();
  });

  it.each([
    [day(2026, 12, 31), 'newyear'],
    [day(2027, 1, 1), 'newyear'],
    [day(2026, 2, 17), 'lunarnewyear'],
    [day(2026, 2, 10), 'valentines'],
    [day(2026, 3, 17), 'stpatricks'],
    [day(2026, 4, 1), 'easter'],
    [day(2026, 4, 5), 'easter'],
    [day(2026, 4, 22), 'earthday'],
    [day(2026, 7, 4), 'july4'],
    [day(2026, 8, 20), 'backtoschool'],
    [day(2026, 10, 31), 'halloween'],
    [day(2026, 11, 26), 'thanksgiving'],
    [day(2026, 12, 6), 'hanukkah'],
    [day(2026, 12, 20), 'christmas'],
  ] as const)('%s is %s', (date, holiday) => {
    expect(holidayFor(date)).toBe(holiday);
    expect(seasonalTheme(date)).toBe(holiday);
  });

  it('falls back to the season between holidays', () => {
    expect(holidayFor(day(2026, 5, 10))).toBeNull();
    expect(seasonalTheme(day(2026, 5, 10))).toBe('spring');
    expect(seasonalTheme(day(2026, 10, 1))).toBe('fall');
    expect(seasonalTheme(day(2026, 6, 20))).toBe('summer');
    expect(seasonalTheme(day(2027, 1, 10))).toBe('winter');
  });

  it('shows the season once the moving-date tables run out', () => {
    expect(hanukkahNight(day(2040, 12, 10))).toBeNull();
    expect(seasonalTheme(day(2040, 2, 20))).toBe('winter');
  });
});
