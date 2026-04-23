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

export function getTemperatureCategory(
  temp: number,
  customThresholds?: { cold: number; cool: number; warm: number },
): TemperatureCategory {
  const t = customThresholds ?? { cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM };
  if (temp < t.cold) return 'cold';
  if (temp < t.cool) return 'cool';
  if (temp < t.warm) return 'warm';
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

// ============================================================================
// CLOTHING WEATHER RULES
// ============================================================================

import type { ClothingWeatherRules } from '@/lib/types';

/** Weather appropriateness rules for each clothing type */
export const clothingWeatherRules: Record<string, ClothingWeatherRules> = {
  'Tank Top': { blockedIn: ['cold', 'cool'], suggestedIn: ['hot'] },
  'T-Shirt': { blockedIn: ['cold'], suggestedIn: ['warm', 'hot'] },
  'Long Sleeve Shirt': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Polo': { blockedIn: ['cold'], suggestedIn: ['warm'] },
  'Button-Up Shirt': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Jacket': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Sweatshirt': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Crewneck': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Sweater': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Shorts': { blockedIn: ['cold'], suggestedIn: ['hot', 'warm'] },
  'Skirt': { blockedIn: ['cold'], suggestedIn: ['warm', 'hot'] },
  'Jeans': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Pants': { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
  'Sweats': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Leggings': { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
};

export function isClothingAppropriateForWeather(
  clothingType: string,
  temperatureCategory: TemperatureCategory,
): boolean {
  const rules = clothingWeatherRules[clothingType];
  if (!rules) return true;
  return !rules.blockedIn.includes(temperatureCategory);
}

/** Returns user-overridden rules merged with defaults, or just defaults if no overrides. */
export function getUserClothingWeatherRules(
  userRules?: Record<string, ClothingWeatherRules> | null,
): Record<string, ClothingWeatherRules> {
  if (!userRules) return clothingWeatherRules;
  return { ...clothingWeatherRules, ...userRules };
}
