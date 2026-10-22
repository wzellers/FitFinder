// Server-only: fetch current weather and today's high from OpenWeatherMap.
// Used by /api/weather so the API key never reaches the browser.

import type { WeatherData } from '@/lib/weatherApi';

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
