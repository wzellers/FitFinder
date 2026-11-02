// Which seasonal theme the Outfits screen shows on a given day: always one of
// the four seasons, unless a holiday's dates take over.
//
// Holidays with moving dates are worked out (Easter, Thanksgiving) or read
// from a table of first days (Lunar New Year, Hanukkah), so they stay right
// without upkeep until the tables run out; after that the season shows.

export type Season = 'winter' | 'spring' | 'summer' | 'fall';
export type Holiday =
  | 'newyear'
  | 'lunarnewyear'
  | 'valentines'
  | 'stpatricks'
  | 'easter'
  | 'earthday'
  | 'july4'
  | 'backtoschool'
  | 'halloween'
  | 'thanksgiving'
  | 'hanukkah'
  | 'christmas';
export type SeasonalTheme = Season | Holiday;

/** Every theme, in calendar order, with a name for people. */
export const SEASONAL_THEMES: { theme: SeasonalTheme; label: string }[] = [
  { theme: 'winter', label: 'Winter' },
  { theme: 'newyear', label: "New Year's" },
  { theme: 'lunarnewyear', label: 'Lunar New Year' },
  { theme: 'valentines', label: "Valentine's Day" },
  { theme: 'spring', label: 'Spring' },
  { theme: 'stpatricks', label: "St. Patrick's Day" },
  { theme: 'easter', label: 'Easter' },
  { theme: 'earthday', label: 'Earth Day' },
  { theme: 'summer', label: 'Summer' },
  { theme: 'july4', label: 'Fourth of July' },
  { theme: 'backtoschool', label: 'Back to school' },
  { theme: 'fall', label: 'Fall' },
  { theme: 'halloween', label: 'Halloween' },
  { theme: 'thanksgiving', label: 'Thanksgiving' },
  { theme: 'hanukkah', label: 'Hanukkah' },
  { theme: 'christmas', label: 'Christmas' },
];

/** First day of Lunar New Year, by year. */
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
};

/** The day of Hanukkah's first night (it begins that evening), by year. */
const HANUKKAH: Record<number, [number, number]> = {
  2025: [12, 14],
  2026: [12, 4],
  2027: [12, 24],
  2028: [12, 12],
  2029: [12, 1],
  2030: [12, 20],
  2031: [12, 9],
  2032: [11, 27],
  2033: [12, 16],
  2034: [12, 6],
  2035: [12, 25],
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Whole days from `from` to `to` (both local dates; DST-safe). */
const daysBetween = (from: Date, to: Date) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      DAY_MS,
  );

/** Easter Sunday (Western), by the anonymous Gregorian algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgiving(year: number): Date {
  const first = new Date(year, 10, 1).getDay();
  const firstThursday = 1 + ((4 - first + 7) % 7);
  return new Date(year, 10, firstThursday + 21);
}

/** Which night of Hanukkah `date` is (1–8), or null outside it. */
export function hanukkahNight(date: Date): number | null {
  const start = HANUKKAH[date.getFullYear()];
  if (!start) return null;
  const night = daysBetween(new Date(date.getFullYear(), start[0] - 1, start[1]), date) + 1;
  return night >= 1 && night <= 8 ? night : null;
}

function inLunarNewYear(date: Date): boolean {
  const start = LUNAR_NEW_YEAR[date.getFullYear()];
  if (!start) return false;
  // From two days before to the Lantern Festival, 15 days in.
  const d = daysBetween(new Date(date.getFullYear(), start[0] - 1, start[1]), date);
  return d >= -2 && d <= 14;
}

/** The holiday `date` falls in, if any. Shorter holidays win overlaps. */
export function holidayFor(date: Date): Holiday | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const on = (month: number, from: number, to = from) => m === month && d >= from && d <= to;

  if (on(12, 31) || on(1, 1)) return 'newyear';
  if (on(2, 7, 14)) return 'valentines';
  if (on(3, 14, 17)) return 'stpatricks';
  const toEaster = daysBetween(date, easterSunday(y));
  if (toEaster >= 0 && toEaster <= 6) return 'easter';
  if (on(4, 20, 22)) return 'earthday';
  if (on(7, 1, 4)) return 'july4';
  if (on(10, 15, 31)) return 'halloween';
  const toThanksgiving = daysBetween(date, thanksgiving(y));
  if (toThanksgiving >= -3 && toThanksgiving <= 3) return 'thanksgiving';
  if (hanukkahNight(date)) return 'hanukkah';
  if (inLunarNewYear(date)) return 'lunarnewyear';
  if (on(12, 1, 30)) return 'christmas';
  if (on(8, 18, 31)) return 'backtoschool';
  return null;
}

/** The season `date` is in (meteorological: whole months). */
export function seasonFor(date: Date): Season {
  const m = date.getMonth() + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'fall';
}

/** The theme to show on `date`: its holiday, else its season. */
export function seasonalTheme(date: Date): SeasonalTheme {
  return holidayFor(date) ?? seasonFor(date);
}
