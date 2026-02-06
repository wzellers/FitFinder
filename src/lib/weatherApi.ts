// Weather API utility - Fetches weather data from OpenWeatherMap
// Free tier allows 1000 calls/day - we cache results to minimize API calls

export interface WeatherData {
  temperature: number;        // Current temperature in Fahrenheit
  highTemperature: number;    // Today's high temperature in Fahrenheit
  condition: string;          // Weather condition (e.g., "Clear", "Cloudy", "Rain")
  description: string;        // Detailed description
  icon: string;               // Weather icon code
  humidity: number;           // Humidity percentage
  windSpeed: number;          // Wind speed in mph
  timestamp: number;          // When this data was fetched
  zipCode: string;            // The zip code used for this data
}

// Cache key for localStorage
const WEATHER_CACHE_KEY = 'fitfinder_weather_cache';

// Cache duration: 3 hours (weather doesn't change that quickly)
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000;

// Temperature thresholds for outfit recommendations (in Fahrenheit)
export const TEMPERATURE_THRESHOLDS = {
  COLD: 45,      // Below 45°F - no shorts, tank tops; outerwear required
  COOL: 65,      // 45-65°F - no tank tops; outerwear suggested
  WARM: 80,      // 65-80°F - all items valid
  // Above 80°F - hot; suggest light items, avoid heavy outerwear
} as const;

export type TemperatureCategory = 'cold' | 'cool' | 'warm' | 'hot';

// Determines temperature category based on temperature
export function getTemperatureCategory(temp: number): TemperatureCategory {
  if (temp < TEMPERATURE_THRESHOLDS.COLD) return 'cold';
  if (temp < TEMPERATURE_THRESHOLDS.COOL) return 'cool';
  if (temp < TEMPERATURE_THRESHOLDS.WARM) return 'warm';
  return 'hot';
}

// Gets cached weather data if still valid
function getCachedWeather(zipCode: string): WeatherData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    
    const data: WeatherData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (same zip code and not expired)
    if (data.zipCode === zipCode && (now - data.timestamp) < CACHE_DURATION_MS) {
      return data;
    }
    
    return null;
  } catch {
    return null;
  }
}

// Saves weather data to cache
function setCachedWeather(data: WeatherData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full or unavailable
  }
}

// Fetches weather data from OpenWeatherMap API
export async function fetchWeather(zipCode: string): Promise<WeatherData | null> {
  // Check cache first
  const cached = getCachedWeather(zipCode);
  if (cached) {
    return cached;
  }
  
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
  
  if (!apiKey) {
    console.error('OpenWeatherMap API key not configured. Add NEXT_PUBLIC_OPENWEATHERMAP_API_KEY to your .env.local file.');
    return null;
  }
  
  try {
    // Fetch current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},US&units=imperial&appid=${apiKey}`
    );
    
    if (!currentResponse.ok) {
      const errorData = await currentResponse.json();
      console.error('Weather API error:', errorData.message);
      return null;
    }
    
    const currentData = await currentResponse.json();
    
    // Fetch forecast to get today's high temperature
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?zip=${zipCode},US&units=imperial&appid=${apiKey}`
    );
    
    let highTemperature = currentData.main.temp;
    
    if (forecastResponse.ok) {
      const forecastData = await forecastResponse.json();
      // Get the highest temperature from today's forecast (next 24 hours)
      const todayEnd = Date.now() + 24 * 60 * 60 * 1000;
      const todayForecasts = forecastData.list.filter(
        (item: { dt: number }) => item.dt * 1000 < todayEnd
      );
      if (todayForecasts.length > 0) {
        highTemperature = Math.max(
          ...todayForecasts.map((item: { main: { temp: number } }) => item.main.temp)
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
      zipCode: zipCode
    };
    
    // Cache the result
    setCachedWeather(weatherData);
    
    return weatherData;
  } catch (error) {
    console.error('Failed to fetch weather data:', error);
    return null;
  }
}

// Gets the weather icon URL from OpenWeatherMap
export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

// Clears the weather cache (useful when user changes zip code)
export function clearWeatherCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WEATHER_CACHE_KEY);
}
