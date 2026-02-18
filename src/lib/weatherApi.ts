// Weather API utility — fetches data from OpenWeatherMap (free tier, cached 3h)

export interface WeatherData {
  temperature: number;
  highTemperature: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  timestamp: number;
  zipCode: string;
}

const WEATHER_CACHE_KEY = 'fitfinder_weather_cache';
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000;

export const TEMPERATURE_THRESHOLDS = {
  COLD: 45,
  COOL: 65,
  WARM: 80,
} as const;

export type TemperatureCategory = 'cold' | 'cool' | 'warm' | 'hot';

export function getTemperatureCategory(temp: number): TemperatureCategory {
  if (temp < TEMPERATURE_THRESHOLDS.COLD) return 'cold';
  if (temp < TEMPERATURE_THRESHOLDS.COOL) return 'cool';
  if (temp < TEMPERATURE_THRESHOLDS.WARM) return 'warm';
  return 'hot';
}

function getCachedWeather(zipCode: string): WeatherData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const data: WeatherData = JSON.parse(cached);
    if (data.zipCode === zipCode && Date.now() - data.timestamp < CACHE_DURATION_MS) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedWeather(data: WeatherData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full or unavailable
  }
}

export async function fetchWeather(zipCode: string): Promise<WeatherData | null> {
  const cached = getCachedWeather(zipCode);
  if (cached) return cached;

  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  try {
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},US&units=imperial&appid=${apiKey}`,
    );
    if (!currentResponse.ok) return null;
    const currentData = await currentResponse.json();

    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?zip=${zipCode},US&units=imperial&appid=${apiKey}`,
    );

    let highTemperature = currentData.main.temp;
    if (forecastResponse.ok) {
      const forecastData = await forecastResponse.json();
      const todayEnd = Date.now() + 24 * 60 * 60 * 1000;
      const todayForecasts = forecastData.list.filter(
        (item: { dt: number }) => item.dt * 1000 < todayEnd,
      );
      if (todayForecasts.length > 0) {
        highTemperature = Math.max(
          ...todayForecasts.map((item: { main: { temp: number } }) => item.main.temp),
        );
      }
    }

    const weatherData: WeatherData = {
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

    setCachedWeather(weatherData);
    return weatherData;
  } catch {
    return null;
  }
}

export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

export function clearWeatherCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WEATHER_CACHE_KEY);
}
