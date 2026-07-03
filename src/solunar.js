// Solunar feeding-window estimates: moon phase, approximate lunar transits,
// sunrise/sunset (NOAA-style approximation). Good to a few minutes — plenty
// for planning a fishing day.

const SYNODIC = 29.530588853;
const LUNAR_DAY_MS = 24.8412 * 3600000;
const DAY_MS = 86400000;

export function moonAge(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0); // known new moon
  const d = (date.getTime() - ref) / DAY_MS;
  return ((d % SYNODIC) + SYNODIC) % SYNODIC;
}

const PHASES = [
  ['New Moon', '🌑'],
  ['Waxing Crescent', '🌒'],
  ['First Quarter', '🌓'],
  ['Waxing Gibbous', '🌔'],
  ['Full Moon', '🌕'],
  ['Waning Gibbous', '🌖'],
  ['Last Quarter', '🌗'],
  ['Waning Crescent', '🌘'],
];

export function moonPhase(age) {
  const idx = Math.round((age / SYNODIC) * 8) % 8;
  const illum = (1 - Math.cos((age / SYNODIC) * Math.PI * 2)) / 2;
  return { name: PHASES[idx][0], emoji: PHASES[idx][1], illum };
}

const toJulian = (ms) => ms / DAY_MS + 2440587.5;
const fromJulian = (j) => (j - 2440587.5) * DAY_MS;

export function sunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const J2000 = 2451545.0;
  const lw = -lon;
  const jd = toJulian(date.getTime());
  const n = Math.round(jd - J2000 - 0.0009 - lw / 360);
  const Jstar = J2000 + 0.0009 + lw / 360 + n;
  const M = ((357.5291 + 0.98560028 * (Jstar - J2000)) % 360 + 360) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = ((M + C + 180 + 102.9372) % 360 + 360) % 360;
  const Jtransit = Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cosH =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) /
    (Math.cos(lat * rad) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) / rad;
  return {
    sunrise: new Date(fromJulian(Jtransit - H / 360)),
    sunset: new Date(fromJulian(Jtransit + H / 360)),
    solarNoon: new Date(fromJulian(Jtransit)),
  };
}

function addWindow(arr, type, start, end, dayStart, dayEnd) {
  if (end <= dayStart || start >= dayEnd) return;
  arr.push({ type, start: Math.max(start, dayStart), end: Math.min(end, dayEnd) });
}

const overlapsNear = (w, t) => t > w.start - 75 * 60000 && t < w.end + 75 * 60000;

// dayStartDate: a Date at local midnight for the day of interest.
export function solunarDay(dayStartDate, lat, lon) {
  const dayStart = dayStartDate.getTime();
  const dayEnd = dayStart + DAY_MS;
  const noon = new Date(dayStart + DAY_MS / 2);
  const sun =
    sunTimes(noon, lat, lon) || {
      sunrise: new Date(dayStart + 6 * 3600000),
      sunset: new Date(dayStart + 18 * 3600000),
      solarNoon: noon,
    };
  const age = moonAge(noon);
  const phase = moonPhase(age);

  // Moon transits with the sun at new moon and drifts ~50 min/day later.
  const upper = sun.solarNoon.getTime() + (age / SYNODIC) * DAY_MS;
  const windows = [];
  for (let k = -4; k <= 4; k++) {
    const tMaj = upper + (k * LUNAR_DAY_MS) / 2; // upper & lower transits
    addWindow(windows, 'major', tMaj - 60 * 60000, tMaj + 60 * 60000, dayStart, dayEnd);
    const tMin = tMaj + LUNAR_DAY_MS / 4; // ~moonrise / moonset
    addWindow(windows, 'minor', tMin - 35 * 60000, tMin + 35 * 60000, dayStart, dayEnd);
  }
  windows.sort((a, b) => a.start - b.start);

  const dNew = Math.min(age, SYNODIC - age);
  const dFull = Math.abs(age - SYNODIC / 2);
  const m = Math.min(dNew, dFull);
  let score = m < 1.5 ? 4 : m < 3.5 ? 3 : m < 6.5 ? 2 : 1;
  const duskDawnBonus = windows.some(
    (w) =>
      w.type === 'major' &&
      (overlapsNear(w, sun.sunrise.getTime()) || overlapsNear(w, sun.sunset.getTime()))
  );
  if (duskDawnBonus && score < 4) score += 1;
  const labels = ['', 'Slow', 'Fair', 'Good', 'Excellent'];
  return { sun, age, phase, windows, score, label: labels[score], duskDawnBonus };
}
