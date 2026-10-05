import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWeatherFromProvider } from '@/lib/weatherProvider';

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
