// Server-only: fetch weather from OpenWeatherMap. Used by /api/weather and the
// daily email, so the API key never reaches the browser.

import type { WeatherData } from '@/lib/weatherApi';
import type { DailyForecast } from '@/lib/dailyEmail/digest';

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

export async function fetchWeatherFromProvider(
  zipCode: string,
  apiKey: string,
): Promise<WeatherData | null> {
  const query = `zip=${encodeURIComponent(zipCode)},US&units=imperial&appid=${apiKey}`;
  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`${OWM_BASE}/weather?${query}`),
      fetch(`${OWM_BASE}/forecast?${query}`),
    ]);
    if (!currentResponse.ok) return null;
    const currentData = await currentResponse.json();

    let highTemperature = currentData.main.temp;
    if (forecastResponse.ok) {
      const forecastData = await forecastResponse.json();
      const todayEnd = Date.now() + 24 * 60 * 60 * 1000;
      const todayForecasts = forecastData.list.filter(
        (item: { dt: number }) => item.dt * 1000 < todayEnd,
      );
      if (todayForecasts.length > 0) {
        highTemperature = Math.max(
          highTemperature,
          ...todayForecasts.map((item: { main: { temp: number } }) => item.main.temp),
        );
      }
    }

    return {
      temperature: Math.round(currentData.main.temp),
      highTemperature: Math.round(highTemperature),
      condition: currentData.weather[0].main,
      description: currentData.weather[0].description,
      icon: currentData.weather[0].icon,
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed),
      timestamp: Date.now(),
      zipCode,
    };
  } catch {
    return null;
  }
}

interface ForecastEntry {
  dt: number;
  main: { temp: number; temp_min?: number; temp_max?: number };
  weather: { main: string; description: string }[];
  pop?: number;
}

/**
 * The rest of today's forecast for a US ZIP code: high, low, the highest
 * chance of rain and the most common condition. "Today" is the calendar day
 * where the ZIP code is, from OpenWeatherMap's own UTC offset for the city.
 */
export async function fetchDailyForecast(
  zipCode: string,
  apiKey: string,
  now: Date = new Date(),
): Promise<DailyForecast | null> {
  const query = `zip=${encodeURIComponent(zipCode)},US&units=imperial&appid=${apiKey}`;
  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`${OWM_BASE}/weather?${query}`),
      fetch(`${OWM_BASE}/forecast?${query}`),
    ]);
    if (!forecastResponse.ok) return null;
    const forecastData = await forecastResponse.json();
    const offsetMs = (forecastData.city?.timezone ?? 0) * 1000;
    const localDate = (ms: number) => new Date(ms + offsetMs).toISOString().slice(0, 10);
    const today = localDate(now.getTime());

    let entries: ForecastEntry[] = (forecastData.list ?? []).filter(
      (e: ForecastEntry) => localDate(e.dt * 1000) === today,
    );
    // Late in the day the remaining slots can run out; use the next few instead.
    if (entries.length === 0) entries = (forecastData.list ?? []).slice(0, 3);
    if (entries.length === 0) return null;

    const temps = entries.flatMap((e) => [
      e.main.temp,
      e.main.temp_max ?? e.main.temp,
      e.main.temp_min ?? e.main.temp,
    ]);
    if (currentResponse.ok) {
      const current = await currentResponse.json();
      if (typeof current.main?.temp === 'number') temps.push(current.main.temp);
    }

    // The condition seen most often today; ties go to the earliest.
    const counts = new Map<string, { count: number; description: string }>();
    for (const e of entries) {
      const w = e.weather[0];
      if (!w) continue;
      const c = counts.get(w.main) ?? { count: 0, description: w.description };
      c.count++;
      counts.set(w.main, c);
    }
    const [condition, { description }] = [...counts.entries()].reduce((a, b) =>
      b[1].count > a[1].count ? b : a,
    );

    return {
      high: Math.round(Math.max(...temps)),
      low: Math.round(Math.min(...temps)),
      rainChance: Math.max(...entries.map((e) => e.pop ?? 0)),
      condition,
      description,
    };
  } catch {
    return null;
  }
}
