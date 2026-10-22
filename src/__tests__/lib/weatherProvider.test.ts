import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDailyForecast, fetchWeatherFromProvider } from '@/lib/weatherProvider';

describe('fetchWeatherFromProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('combines current conditions with the forecast high', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 72, humidity: 55 },
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
          wind: { speed: 10 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            { dt: Math.floor((Date.now() + 3600000) / 1000), main: { temp: 80 } },
            { dt: Math.floor((Date.now() + 7200000) / 1000), main: { temp: 75 } },
          ],
        }),
      } as Response);

    const result = await fetchWeatherFromProvider('10001', 'key');
    expect(result).toMatchObject({
      temperature: 72,
      highTemperature: 80,
      condition: 'Clear',
      humidity: 55,
      windSpeed: 10,
      zipCode: '10001',
    });
  });

  it('falls back to the current temperature when the forecast fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 65, humidity: 40 },
          weather: [{ main: 'Clouds', description: 'overcast', icon: '04d' }],
          wind: { speed: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    const result = await fetchWeatherFromProvider('90210', 'key');
    expect(result?.highTemperature).toBe(65);
  });

  it('returns null when current conditions fail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchWeatherFromProvider('99999', 'key')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
    expect(await fetchWeatherFromProvider('33333', 'key')).toBeNull();
  });
});

describe('fetchDailyForecast', () => {
  // 11:00 UTC is 07:00 in New York (UTC-4); the forecast's city offset says so.
  const now = new Date('2026-10-13T11:00:00Z');
  const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
  const entry = (iso: string, temp: number, main: string, pop = 0) => ({
    dt: at(iso),
    main: { temp },
    weather: [{ main, description: main.toLowerCase() }],
    pop,
  });
  const current = (temp: number) =>
    ({ ok: true, json: async () => ({ main: { temp } }) }) as Response;
  const forecast = (list: unknown[]) =>
    ({ ok: true, json: async () => ({ city: { timezone: -4 * 3600 }, list }) }) as Response;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('summarizes the rest of the local day', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(current(48))
      .mockResolvedValueOnce(
        forecast([
          entry('2026-10-13T12:00:00Z', 52, 'Clouds'),
          entry('2026-10-13T18:00:00Z', 64, 'Rain', 0.7),
          entry('2026-10-14T00:00:00Z', 58, 'Rain', 0.4),
          // 03:00 UTC on the 14th is still the 13th in New York.
          entry('2026-10-14T03:00:00Z', 55, 'Clouds'),
          // The next local day: ignored.
          entry('2026-10-14T06:00:00Z', 30, 'Snow', 1),
        ]),
      );

    expect(await fetchDailyForecast('10001', 'key', now)).toEqual({
      high: 64,
      low: 48,
      rainChance: 0.7,
      condition: 'Clouds',
      description: 'clouds',
    });
  });

  it('uses the next slots late in the day and works without current conditions', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce(forecast([entry('2026-10-14T06:00:00Z', 40, 'Clear')]));
    // 23:30 in New York, after the day's last slot.
    const result = await fetchDailyForecast('10001', 'key', new Date('2026-10-14T03:30:00Z'));
    expect(result).toMatchObject({ high: 40, low: 40, condition: 'Clear' });
  });

  it('returns null when the forecast fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(current(50))
      .mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchDailyForecast('10001', 'key', now)).toBeNull();
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
    expect(await fetchDailyForecast('10001', 'key', now)).toBeNull();
  });
});
