// Weather API utility — fetches data from OpenWeatherMap (free tier, cached 3h)

import { supabase } from '@/lib/supabaseClient';

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
  const t = customThresholds ?? {
    cold: TEMPERATURE_THRESHOLDS.COLD,
    cool: TEMPERATURE_THRESHOLDS.COOL,
    warm: TEMPERATURE_THRESHOLDS.WARM,
  };
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

/**
 * Today's weather for a US ZIP code, cached in localStorage for 3 hours.
 * The OpenWeatherMap key stays on the server: this calls /api/weather, which
 * requires the user's Supabase session.
 */
export async function fetchWeather(zipCode: string): Promise<WeatherData | null> {
  const cached = getCachedWeather(zipCode);
  if (cached) return cached;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/api/weather', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ zip: zipCode }),
    });
    if (!res.ok) return null;
    const weatherData: WeatherData = await res.json();

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
  Polo: { blockedIn: ['cold'], suggestedIn: ['warm'] },
  'Button-Up Shirt': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  Jacket: { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  Sweatshirt: { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  Crewneck: { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  Sweater: { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  Shorts: { blockedIn: ['cold'], suggestedIn: ['hot', 'warm'] },
  Skirt: { blockedIn: ['cold'], suggestedIn: ['warm', 'hot'] },
  Jeans: { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  Pants: { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
  Sweats: { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  Leggings: { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
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
