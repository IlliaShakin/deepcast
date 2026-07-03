// Live weather for a lake via Open-Meteo (free, no key, CORS-enabled).
// Returns null on any failure so the app degrades gracefully offline.

export async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,is_day` +
    `&hourly=surface_pressure&past_hours=6&forecast_hours=1&timezone=auto`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    const c = j.current || {};
    const series = (j.hourly?.surface_pressure || []).filter((v) => v != null);
    let trend = 0; // hPa change over ~3h
    if (series.length >= 4) trend = series[series.length - 1] - series[series.length - 4];
    return {
      tempC: c.temperature_2m,
      pressure: c.surface_pressure,
      pressureTrend: Math.round(trend * 10) / 10,
      windSpeed: c.wind_speed_10m, // km/h
      windDirDeg: c.wind_direction_10m, // degrees FROM
      cloudPct: c.cloud_cover,
      isDay: c.is_day === 1,
      time: c.time,
    };
  } catch {
    return null;
  }
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg) => DIRS[Math.round(((deg % 360) / 22.5)) % 16];

export function pressureWord(trend) {
  if (trend <= -1.5) return 'falling fast';
  if (trend <= -0.4) return 'falling';
  if (trend >= 1.5) return 'rising fast';
  if (trend >= 0.4) return 'rising';
  return 'steady';
}
