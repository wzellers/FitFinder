import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns null when no API key', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', '');
    const result = await fetchWeather('10001');
    expect(result).toBeNull();
  });

  it('returns null on non-OK response', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const result = await fetchWeather('99999');
    expect(result).toBeNull();
  });

  it('returns WeatherData on success', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    const mockCurrent = {
      main: { temp: 72, humidity: 55 },
      weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
      wind: { speed: 10 },
    };
    const mockForecast = {
      list: [
        { dt: Math.floor((Date.now() + 3600000) / 1000), main: { temp: 80 } },
        { dt: Math.floor((Date.now() + 7200000) / 1000), main: { temp: 75 } },
      ],
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCurrent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockForecast,
      } as Response);

    const result = await fetchWeather('10001');
    expect(result).not.toBeNull();
    expect(result?.temperature).toBe(72);
    expect(result?.highTemperature).toBe(80);
    expect(result?.condition).toBe('Clear');
    expect(result?.zipCode).toBe('10001');
    expect(result?.humidity).toBe(55);
    expect(result?.windSpeed).toBe(10);
  });

  it('saves weather data to localStorage after successful fetch', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    const mockCurrent = {
      main: { temp: 65, humidity: 40 },
      weather: [{ main: 'Clouds', description: 'overcast', icon: '04d' }],
      wind: { speed: 5 },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCurrent,
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    await fetchWeather('90210');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'fitfinder_weather_cache',
      expect.stringContaining('"zipCode":"90210"'),
    );
  });

  it('returns cached data when cache is fresh and zip matches', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    const cached = {
      temperature: 55,
      highTemperature: 60,
      condition: 'Rain',
      description: 'light rain',
      icon: '10d',
      humidity: 80,
      windSpeed: 8,
      timestamp: Date.now() - 1000,
      zipCode: '11111',
    };
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(cached));

    const result = await fetchWeather('11111');
    expect(result?.zipCode).toBe('11111');
    expect(result?.condition).toBe('Rain');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bypasses cache when zip code differs', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    const cached = {
      temperature: 55,
      highTemperature: 60,
      condition: 'Rain',
      description: 'light rain',
      icon: '10d',
      humidity: 80,
      windSpeed: 8,
      timestamp: Date.now() - 1000,
      zipCode: '11111',
    };
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(cached));
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);

    const result = await fetchWeather('22222');
    expect(fetch).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchWeather('33333');
    expect(result).toBeNull();
  });

  it('returns null when cached data is corrupt JSON (getCachedWeather catch block)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', '');
    // Corrupt JSON triggers the catch block in getCachedWeather → returns null
    vi.mocked(localStorage.getItem).mockReturnValueOnce('not-valid-json{{{');
    const result = await fetchWeather('44444');
    expect(result).toBeNull();
  });

  it('does not throw when localStorage.setItem throws (setCachedWeather catch block)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', 'test-key');
    const mockCurrent = {
      main: { temp: 70, humidity: 50 },
      weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
      wind: { speed: 5 },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockCurrent } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    // Make setItem throw to exercise the catch block in setCachedWeather
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw despite localStorage.setItem failing
    await expect(fetchWeather('55555')).resolves.not.toThrow();
  });
});
