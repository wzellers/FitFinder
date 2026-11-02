// Which background scene the Outfits screen shows for the current weather.

export type WeatherScene = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

export interface SceneChoice {
  scene: WeatherScene;
  /** Night time: a clear sky shows stars instead of sun. */
  night: boolean;
  /** Thunder: rain with the odd faint flash. */
  storm: boolean;
}

/**
 * Map OpenWeatherMap's icon code (e.g. "10d", "01n") to a scene, falling back
 * to the condition text when the icon is unknown. Mist and fog count as
 * cloudy; drizzle and thunderstorms as rainy.
 */
export function weatherScene(icon: string, condition = ''): SceneChoice {
  const code = icon.slice(0, 2);
  const night = icon.endsWith('n');
  const text = condition.toLowerCase();
  const storm = code === '11' || text.includes('thunder');
  let scene: WeatherScene;
  if (code === '01') scene = 'sunny';
  else if (['02', '03', '04', '50'].includes(code)) scene = 'cloudy';
  else if (['09', '10', '11'].includes(code)) scene = 'rainy';
  else if (code === '13') scene = 'snowy';
  else if (/rain|drizzle|thunder/.test(text)) scene = 'rainy';
  else if (/snow|sleet/.test(text)) scene = 'snowy';
  else if (text.includes('clear')) scene = 'sunny';
  else scene = 'cloudy';
  return { scene, night, storm };
}
