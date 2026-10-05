import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import {
  getTemperatureCategory,
  getWeatherIconUrl,
  clearWeatherCache,
  fetchWeather,
} from '@/lib/weatherApi';

describe('getTemperatureCategory', () => {
  describe('with default thresholds (cold=45, cool=65, warm=80)', () => {
    it('returns cold below 45', () => {
      expect(getTemperatureCategory(44)).toBe('cold');
      expect(getTemperatureCategory(0)).toBe('cold');
    });

    it('returns cool at/between 45 and 64', () => {
      expect(getTemperatureCategory(45)).toBe('cool');
      expect(getTemperatureCategory(60)).toBe('cool');
      expect(getTemperatureCategory(64)).toBe('cool');
    });

    it('returns warm at/between 65 and 79', () => {
      expect(getTemperatureCategory(65)).toBe('warm');
      expect(getTemperatureCategory(75)).toBe('warm');
      expect(getTemperatureCategory(79)).toBe('warm');
    });

    it('returns hot at 80 and above', () => {
      expect(getTemperatureCategory(80)).toBe('hot');
      expect(getTemperatureCategory(100)).toBe('hot');
    });
  });

  describe('with custom thresholds', () => {
    const custom = { cold: 32, cool: 55, warm: 75 };

    it('respects custom cold threshold', () => {
      expect(getTemperatureCategory(31, custom)).toBe('cold');
      expect(getTemperatureCategory(32, custom)).toBe('cool');
    });

    it('respects custom cool threshold', () => {
      expect(getTemperatureCategory(54, custom)).toBe('cool');
      expect(getTemperatureCategory(55, custom)).toBe('warm');
    });

    it('respects custom warm threshold', () => {
      expect(getTemperatureCategory(74, custom)).toBe('warm');
      expect(getTemperatureCategory(75, custom)).toBe('hot');
    });
  });
});

describe('getWeatherIconUrl', () => {
  it('returns correct OpenWeatherMap URL', () => {
    const url = getWeatherIconUrl('10d');
    expect(url).toBe('https://openweathermap.org/img/wn/10d@2x.png');
  });
});

describe('clearWeatherCache', () => {
  it('calls localStorage.removeItem with the cache key', () => {
    clearWeatherCache();
    expect(localStorage.removeItem).toHaveBeenCalledWith('fitfinder_weather_cache');
  });
});

describe('fetchWeather', () => {
  const weather = {
    temperature: 72,
    highTemperature: 80,
    condition: 'Clear',
    description: 'clear sky',
    icon: '01d',
    humidity: 55,
    windSpeed: 10,
    timestamp: Date.now(),
    zipCode: '10001',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls /api/weather with the session token and caches the result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => weather } as Response);

    const result = await fetchWeather('10001');

    expect(result?.temperature).toBe(72);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/weather');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init?.body as string)).toEqual({ zip: '10001' });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'fitfinder_weather_cache',
      expect.stringContaining('"zipCode":"10001"'),
    );
  });

  it('never calls OpenWeatherMap directly from the browser', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => weather } as Response);
    await fetchWeather('10001');
    for (const [url] of vi.mocked(fetch).mock.calls) {
      expect(String(url)).not.toContain('openweathermap');
    }
  });

  it('returns null when signed out', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await fetchWeather('10001')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchWeather('99999')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    expect(await fetchWeather('33333')).toBeNull();
  });

  it('returns cached data when cache is fresh and zip matches', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify({ ...weather, zipCode: '11111', timestamp: Date.now() - 1000 }),
    );
    const result = await fetchWeather('11111');
    expect(result?.zipCode).toBe('11111');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bypasses cache when zip code differs', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify({ ...weather, zipCode: '11111', timestamp: Date.now() - 1000 }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await fetchWeather('22222');
    expect(fetch).toHaveBeenCalled();
  });

  it('ignores corrupt cache data', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('not-valid-json{{{');
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchWeather('44444')).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => weather } as Response);
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(fetchWeather('55555')).resolves.not.toThrow();
  });
});
